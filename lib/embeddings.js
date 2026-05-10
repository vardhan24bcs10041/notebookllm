/**
 * Gemini Embedding Module with Automatic Model Fallback
 * 
 * Uses Google's text-embedding-004 model to generate vector embeddings.
 * Implements automatic model rotation when rate limits (429) are hit.
 * 
 * Embedding Models Available (Free Tier):
 * - text-embedding-004: Primary model, high quality
 * - embedding-001: Fallback model
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Embedding model rotation pool (confirmed working on v1beta API)
const EMBEDDING_MODELS = [
  "gemini-embedding-001",
  "gemini-embedding-2",
];

let currentEmbeddingModelIndex = 0;

/**
 * Get the current embedding model name
 */
function getCurrentEmbeddingModel() {
  return EMBEDDING_MODELS[currentEmbeddingModelIndex];
}

/**
 * Rotate to the next embedding model
 */
function rotateEmbeddingModel() {
  currentEmbeddingModelIndex =
    (currentEmbeddingModelIndex + 1) % EMBEDDING_MODELS.length;
  console.log(
    `[Embeddings] Rotated to model: ${getCurrentEmbeddingModel()}`
  );
}

/**
 * Generate embeddings for an array of text chunks.
 * Automatically retries with fallback models on rate limit errors.
 * 
 * @param {string[]} texts - Array of text strings to embed
 * @param {string} apiKey - Google AI API key
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function embedTexts(texts, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError = null;

  // Try each model in the rotation pool
  for (let attempt = 0; attempt < EMBEDDING_MODELS.length; attempt++) {
    const modelName = getCurrentEmbeddingModel();

    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const embeddings = [];

      // Process in batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (text) => {
            const result = await model.embedContent(text);
            return result.embedding.values;
          })
        );
        embeddings.push(...batchResults);

        // Small delay between batches to respect rate limits
        if (i + batchSize < texts.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      console.log(
        `[Embeddings] Generated ${embeddings.length} embeddings using ${modelName}`
      );
      return embeddings;
    } catch (error) {
      lastError = error;
      console.error(
        `[Embeddings] Error with ${modelName}:`,
        error.message
      );

      // If rate limited or model not found, rotate to next model
      if (
        error.status === 429 ||
        error.status === 404 ||
        error.message?.includes("429") ||
        error.message?.includes("404") ||
        error.message?.includes("not found")
      ) {
        console.log(`[Embeddings] Error on ${modelName} (${error.status || 'unknown'}), rotating...`);
        rotateEmbeddingModel();
        continue;
      }

      // For other errors, throw immediately
      throw error;
    }
  }

  throw new Error(
    `All embedding models exhausted. Last error: ${lastError?.message}`
  );
}

/**
 * Generate embedding for a single query string.
 * 
 * @param {string} query - The query text to embed
 * @param {string} apiKey - Google AI API key
 * @returns {Promise<number[]>} Embedding vector
 */
async function embedQuery(query, apiKey) {
  const results = await embedTexts([query], apiKey);
  return results[0];
}

module.exports = { embedTexts, embedQuery };
