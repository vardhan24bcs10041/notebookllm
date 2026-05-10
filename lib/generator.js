/**
 * Gemini LLM Generator with Automatic Model Rotation
 * 
 * Generates grounded answers using retrieved context from the vector store.
 * Implements automatic model fallback when rate limits are hit.
 * 
 * Model Priority (ordered by free-tier limits):
 * 1. gemini-3.1-flash-lite  — 15 RPM, 500 RPD (highest limits)
 * 2. gemini-2.5-flash-lite  — 10 RPM, 20 RPD
 * 3. gemini-3-flash         — 5 RPM, 20 RPD
 * 4. gemini-2.5-flash       — 5 RPM, 20 RPD
 * 
 * Combined: ~35 RPM, ~560 RPD
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Model rotation pool — ordered by free tier generosity
const GENERATION_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];

let currentModelIndex = 0;

// Track model usage for proactive rotation
const modelUsage = new Map();

/**
 * Get current generation model name
 */
function getCurrentModel() {
  return GENERATION_MODELS[currentModelIndex];
}

/**
 * Rotate to the next generation model
 */
function rotateModel() {
  const prevModel = getCurrentModel();
  currentModelIndex = (currentModelIndex + 1) % GENERATION_MODELS.length;
  console.log(
    `[Generator] Rotated from ${prevModel} to ${getCurrentModel()}`
  );
}

/**
 * Track usage of a model call
 */
function trackUsage(modelName) {
  const now = Date.now();
  if (!modelUsage.has(modelName)) {
    modelUsage.set(modelName, []);
  }
  const usage = modelUsage.get(modelName);
  usage.push(now);

  // Clean up entries older than 1 minute (for RPM tracking)
  const oneMinuteAgo = now - 60000;
  const filtered = usage.filter((t) => t > oneMinuteAgo);
  modelUsage.set(modelName, filtered);

  return filtered.length;
}

/**
 * Build the grounded system prompt with retrieved context.
 * This prompt ensures the LLM only answers from the document.
 */
function buildSystemPrompt(contextChunks) {
  const contextText = contextChunks
    .map((result, i) => {
      const { chunk, score } = result;
      return `--- Context Chunk ${i + 1} (Page ${chunk.metadata?.pageNumber || "N/A"}, Relevance: ${(score * 100).toFixed(1)}%) ---\n${chunk.text}`;
    })
    .join("\n\n");

  return `You are an AI assistant that answers questions ONLY based on the provided document context. You are part of a RAG (Retrieval-Augmented Generation) pipeline.

STRICT RULES:
1. ONLY answer based on the context provided below. Do NOT use your general knowledge.
2. If the answer is not found in the context, say: "I couldn't find information about that in the uploaded document."
3. Always cite which page or section your answer comes from when possible.
4. Be precise and helpful. Quote relevant passages when appropriate.
5. If the question is ambiguous, explain what you found and ask for clarification.

DOCUMENT CONTEXT:
${contextText}

Remember: Your answers must be grounded in the document above. Do not hallucinate or make up information.`;
}

/**
 * Generate a grounded answer using retrieved context.
 * Implements automatic model fallback on rate limit errors.
 * 
 * @param {string} question - User's question
 * @param {Array} contextChunks - Retrieved chunks from vector store
 * @param {string} apiKey - Google AI API key
 * @returns {Promise<{answer: string, model: string, sources: Array}>}
 */
async function generateAnswer(question, contextChunks, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const systemPrompt = buildSystemPrompt(contextChunks);
  let lastError = null;

  // Try each model in the rotation pool
  for (let attempt = 0; attempt < GENERATION_MODELS.length; attempt++) {
    const modelName = getCurrentModel();

    try {
      // Track usage and proactively rotate if nearing limits
      const recentCalls = trackUsage(modelName);
      if (recentCalls > 12) {
        // Getting close to RPM limit
        console.log(
          `[Generator] ${modelName} nearing rate limit (${recentCalls} calls/min), proactively rotating`
        );
        rotateModel();
        continue;
      }

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContent(question);
      const answer = result.response.text();

      // Extract source citations
      const sources = contextChunks.map((result) => ({
        pageNumber: result.chunk.metadata?.pageNumber,
        sourceFile: result.chunk.metadata?.sourceFile,
        relevance: (result.score * 100).toFixed(1) + "%",
        preview: result.chunk.text.slice(0, 100) + "...",
      }));

      console.log(`[Generator] Answer generated using ${modelName}`);

      return {
        answer,
        model: modelName,
        sources,
      };
    } catch (error) {
      lastError = error;
      console.error(
        `[Generator] Error with ${modelName}:`,
        error.message
      );

      // Rate limited — rotate to next model
      if (error.status === 429 || error.message?.includes("429") || error.message?.includes("Resource has been exhausted")) {
        console.log(
          `[Generator] Rate limited on ${modelName}, rotating to next model...`
        );
        rotateModel();
        continue;
      }

      // For other errors, try next model too
      rotateModel();
    }
  }

  throw new Error(
    `All generation models exhausted. Please try again in a minute. Last error: ${lastError?.message}`
  );
}

/**
 * Generate a streaming answer (returns a ReadableStream).
 * 
 * @param {string} question - User's question
 * @param {Array} contextChunks - Retrieved chunks from vector store
 * @param {string} apiKey - Google AI API key
 * @returns {Promise<{stream: ReadableStream, model: string, sources: Array}>}
 */
async function generateStreamingAnswer(question, contextChunks, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const systemPrompt = buildSystemPrompt(contextChunks);
  let lastError = null;

  for (let attempt = 0; attempt < GENERATION_MODELS.length; attempt++) {
    const modelName = getCurrentModel();

    try {
      trackUsage(modelName);

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContentStream(question);

      const sources = contextChunks.map((r) => ({
        pageNumber: r.chunk.metadata?.pageNumber,
        sourceFile: r.chunk.metadata?.sourceFile,
        relevance: (r.score * 100).toFixed(1) + "%",
        preview: r.chunk.text.slice(0, 100) + "...",
      }));

      console.log(`[Generator] Streaming answer using ${modelName}`);

      return {
        stream: result.stream,
        model: modelName,
        sources,
      };
    } catch (error) {
      lastError = error;
      if (error.status === 429 || error.message?.includes("429") || error.message?.includes("Resource has been exhausted")) {
        rotateModel();
        continue;
      }
      rotateModel();
    }
  }

  throw new Error(
    `All generation models exhausted. Last error: ${lastError?.message}`
  );
}

module.exports = { generateAnswer, generateStreamingAnswer, getCurrentModel };
