/**
 * In-Memory Vector Store with Cosine Similarity
 * 
 * This module implements a lightweight vector database that stores
 * document chunk embeddings in memory and performs similarity search
 * using cosine similarity.
 * 
 * How it works:
 * 1. Document chunks are stored alongside their embedding vectors
 * 2. When a query arrives, its embedding is compared against all stored embeddings
 * 3. Cosine similarity measures the angle between vectors (1 = identical, 0 = orthogonal)
 * 4. Top-K most similar chunks are returned as context for the LLM
 * 
 * Why in-memory?
 * - Vercel serverless functions don't persist state, but within a session it works
 * - No external database dependency (free, simple deployment)
 * - For a demo/assignment, this is perfectly adequate
 * - Can be swapped for Qdrant/Pinecone for production use
 */

// Global store that persists across API calls within the same serverless instance
// Key: sessionId, Value: { chunks: [], embeddings: [] }
const globalStore = new Map();

/**
 * Compute cosine similarity between two vectors.
 * 
 * Formula: cos(θ) = (A · B) / (||A|| × ||B||)
 * 
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} Similarity score between -1 and 1
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error(
      `Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (normA * normB);
}

/**
 * Store document chunks and their embeddings in the vector store.
 * 
 * @param {string} sessionId - Unique session identifier
 * @param {Array<{text: string, metadata: Object}>} chunks - Document chunks with metadata
 * @param {number[][]} embeddings - Corresponding embedding vectors
 */
function addDocuments(sessionId, chunks, embeddings) {
  if (chunks.length !== embeddings.length) {
    throw new Error(
      `Chunks (${chunks.length}) and embeddings (${embeddings.length}) count mismatch`
    );
  }

  // Initialize or append to existing store for this session
  if (!globalStore.has(sessionId)) {
    globalStore.set(sessionId, { chunks: [], embeddings: [] });
  }

  const store = globalStore.get(sessionId);
  store.chunks.push(...chunks);
  store.embeddings.push(...embeddings);

  console.log(
    `[VectorStore] Stored ${chunks.length} chunks for session ${sessionId}. Total: ${store.chunks.length}`
  );
}

/**
 * Search for the most similar chunks to a query embedding.
 * Can use globalStore OR provided chunks/embeddings (for stateless Vercel)
 * 
 * @param {string} sessionId - Session to search within
 * @param {number[]} queryEmbedding - The query's embedding vector
 * @param {number} topK - Number of results to return (default: 5)
 * @param {Array} providedChunks - Optional: chunks passed from frontend
 * @param {Array} providedEmbeddings - Optional: embeddings passed from frontend
 * @returns {Array<{chunk: Object, score: number}>} Top-K results with similarity scores
 */
function search(sessionId, queryEmbedding, topK = 5, providedChunks = null, providedEmbeddings = null) {
  let searchChunks = providedChunks;
  let searchEmbeddings = providedEmbeddings;

  // Fallback to global store if not provided
  if (!searchChunks || !searchEmbeddings) {
    const store = globalStore.get(sessionId);
    if (!store || store.chunks.length === 0) {
      console.warn(`[VectorStore] No documents found for session ${sessionId}`);
      return [];
    }
    searchChunks = store.chunks;
    searchEmbeddings = store.embeddings;
  }

  // Compute similarity for every stored chunk
  const scored = searchChunks.map((chunk, i) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, searchEmbeddings[i]),
  }));

  // Sort by similarity score (descending) and return top-K
  scored.sort((a, b) => b.score - a.score);

  const results = scored.slice(0, topK);

  console.log(
    `[VectorStore] Search returned ${results.length} results. Top score: ${results[0]?.score.toFixed(4)}`
  );

  return results;
}

/**
 * Check if a session has documents stored.
 * @param {string} sessionId
 * @returns {boolean}
 */
function hasDocuments(sessionId) {
  const store = globalStore.get(sessionId);
  return store && store.chunks.length > 0;
}

/**
 * Get document info for a session.
 * @param {string} sessionId
 * @returns {Object|null}
 */
function getSessionInfo(sessionId) {
  const store = globalStore.get(sessionId);
  if (!store) return null;

  return {
    chunkCount: store.chunks.length,
    sourceFiles: [
      ...new Set(store.chunks.map((c) => c.metadata?.sourceFile)),
    ],
  };
}

/**
 * Clear documents for a session.
 * @param {string} sessionId
 */
function clearSession(sessionId) {
  globalStore.delete(sessionId);
  console.log(`[VectorStore] Cleared session ${sessionId}`);
}

module.exports = {
  addDocuments,
  search,
  hasDocuments,
  getSessionInfo,
  clearSession,
  cosineSimilarity,
};
