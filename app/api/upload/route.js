/**
 * Document Upload API Route
 * 
 * POST /api/upload
 * 
 * Accepts a document file (PDF or TXT) via multipart form data.
 * Pipeline: Parse → Chunk → Embed → Store in Vector DB
 * 
 * Request: FormData with 'file' field and optional 'sessionId'
 * Response: { success, sessionId, documentInfo, chunkCount }
 */

import { NextResponse } from "next/server";

// Force Node.js runtime instead of Edge to ensure compatibility with pdf-parse and local modules
export const runtime = "nodejs";

import { parseDocument } from "@/lib/pdfParser";
import { chunkDocument } from "@/lib/chunker";
import { embedTexts } from "@/lib/embeddings";
import { addDocuments, clearSession } from "@/lib/vectorStore";

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const sessionId = formData.get("sessionId") || crypto.randomUUID();

    // Validate file presence
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided. Please upload a PDF or TXT file." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["application/pdf", "text/plain", "text/markdown"];
    const allowedExtensions = ["pdf", "txt", "md", "text"];
    const extension = file.name.toLowerCase().split(".").pop();

    if (!allowedExtensions.includes(extension)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: .${extension}. Supported: PDF, TXT, MD`,
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

    console.log(`[Upload] Processing file: ${file.name} (${file.size} bytes)`);

    // Step 1: Parse the document
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseDocument(buffer, file.name);

    console.log(
      `[Upload] Parsed: ${parsed.metadata.charCount} chars, ${parsed.metadata.pageCount} pages`
    );

    // Step 2: Chunk the document
    const chunks = chunkDocument(parsed.text, {
      sourceFile: file.name,
      pages: parsed.pages,
    });

    console.log(`[Upload] Created ${chunks.length} chunks`);

    // Step 3: Generate embeddings for all chunks
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await embedTexts(chunkTexts, apiKey);

    console.log(`[Upload] Generated ${embeddings.length} embeddings`);

    // Step 4: Store in vector database
    // Clear previous documents for this session (fresh upload replaces old)
    clearSession(sessionId);
    addDocuments(sessionId, chunks, embeddings);

    console.log(`[Upload] Stored in vector DB. Session: ${sessionId}`);

    return NextResponse.json({
      success: true,
      sessionId,
      documentInfo: {
        filename: file.name,
        size: file.size,
        pageCount: parsed.metadata.pageCount,
        charCount: parsed.metadata.charCount,
      },
      chunkCount: chunks.length,
      chunks: chunks,
      embeddings: embeddings,
      message: `Successfully processed "${file.name}" into ${chunks.length} chunks.`,
    });
  } catch (error) {
    console.error("[Upload] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process document." },
      { status: 500 }
    );
  }
}
