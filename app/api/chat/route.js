/**
 * Chat API Route
 * 
 * POST /api/chat
 * 
 * Accepts a user question and session ID.
 * Pipeline: Embed Query → Retrieve Top-K → Generate Grounded Answer
 * 
 * Request: { question: string, sessionId: string }
 * Response: Streaming text response with sources appended
 */

import { NextResponse } from "next/server";
import { embedQuery } from "@/lib/embeddings";
import { search, hasDocuments } from "@/lib/vectorStore";
import { generateAnswer } from "@/lib/generator";

export async function POST(request) {
  try {
    const body = await request.json();
    const { question, sessionId } = body;

    // Validate inputs
    if (!question || !question.trim()) {
      return NextResponse.json(
        { error: "Please provide a question." },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "No session ID. Please upload a document first." },
        { status: 400 }
      );
    }

    // Check if documents exist for this session
    if (!hasDocuments(sessionId)) {
      return NextResponse.json(
        {
          error:
            "No documents found for this session. Please upload a document first.",
        },
        { status: 400 }
      );
    }

    // Get API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server configuration error: Missing API key." },
        { status: 500 }
      );
    }

    console.log(`[Chat] Question: "${question.slice(0, 100)}..."`);

    // Step 1: Embed the user's question
    const queryEmbedding = await embedQuery(question, apiKey);
    console.log(`[Chat] Query embedded`);

    // Step 2: Retrieve top-K most relevant chunks
    const topK = 5;
    const relevantChunks = search(sessionId, queryEmbedding, topK);
    console.log(`[Chat] Retrieved ${relevantChunks.length} relevant chunks`);

    if (relevantChunks.length === 0) {
      return NextResponse.json({
        answer:
          "I couldn't find any relevant information in the uploaded document to answer your question.",
        sources: [],
        model: "none",
      });
    }

    // Step 3: Generate grounded answer using LLM
    const result = await generateAnswer(question, relevantChunks, apiKey);

    console.log(`[Chat] Answer generated using ${result.model}`);

    return NextResponse.json({
      answer: result.answer,
      sources: result.sources,
      model: result.model,
    });
  } catch (error) {
    console.error("[Chat] Error:", error);

    // Provide helpful error messages
    if (error.message?.includes("429") || error.message?.includes("exhausted")) {
      return NextResponse.json(
        {
          error:
            "Rate limit reached. All models are temporarily exhausted. Please wait a moment and try again.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to generate answer." },
      { status: 500 }
    );
  }
}
