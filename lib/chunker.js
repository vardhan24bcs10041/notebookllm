/**
 * Recursive Character Text Splitter
 * 
 * CHUNKING STRATEGY:
 * This module implements a recursive text splitting approach for the RAG pipeline.
 * 
 * How it works:
 * 1. The document text is split into chunks of a target size (default: 1000 chars)
 * 2. An overlap (default: 200 chars) is maintained between consecutive chunks
 *    to preserve context across chunk boundaries
 * 3. The splitting is "recursive" — it tries to split on the most semantically
 *    meaningful boundaries first:
 *    - Double newlines (paragraph breaks)
 *    - Single newlines (line breaks)
 *    - Sentences (periods followed by space)
 *    - Spaces (word boundaries)
 *    - Individual characters (last resort)
 * 
 * Why this strategy?
 * - Preserves semantic coherence within chunks
 * - Overlap ensures no information is lost at boundaries
 * - Paragraph-first splitting keeps related ideas together
 * - Configurable sizes allow tuning for different document types
 * 
 * Each chunk includes metadata:
 * - chunkIndex: position in the sequence
 * - sourceFile: original filename
 * - pageNumber: which page(s) the chunk came from (for PDFs)
 * - charStart/charEnd: character offsets in the original text
 */

const DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

/**
 * Split text recursively using a hierarchy of separators
 * @param {string} text - The text to split
 * @param {Object} options - Configuration options
 * @param {number} options.chunkSize - Target chunk size in characters (default: 1000)
 * @param {number} options.chunkOverlap - Overlap between chunks in characters (default: 200)
 * @param {string[]} options.separators - Ordered list of separators to try
 * @returns {string[]} Array of text chunks
 */
function splitTextRecursively(text, options = {}) {
  const {
    chunkSize = 1000,
    chunkOverlap = 200,
    separators = DEFAULT_SEPARATORS,
  } = options;

  const chunks = [];

  if (text.length <= chunkSize) {
    if (text.trim().length > 0) {
      chunks.push(text.trim());
    }
    return chunks;
  }

  // Find the best separator that exists in the text
  let bestSeparator = "";
  for (const sep of separators) {
    if (sep === "" || text.includes(sep)) {
      bestSeparator = sep;
      break;
    }
  }

  // Split text using the chosen separator
  const parts = bestSeparator ? text.split(bestSeparator) : [...text];

  let currentChunk = "";

  for (const part of parts) {
    const candidate = currentChunk
      ? currentChunk + bestSeparator + part
      : part;

    if (candidate.length <= chunkSize) {
      currentChunk = candidate;
    } else {
      // Save current chunk if it has content
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }

      // If the part itself is too large, recursively split it
      if (part.length > chunkSize) {
        const remainingSeparators = separators.slice(
          separators.indexOf(bestSeparator) + 1
        );
        const subChunks = splitTextRecursively(part, {
          chunkSize,
          chunkOverlap,
          separators:
            remainingSeparators.length > 0
              ? remainingSeparators
              : DEFAULT_SEPARATORS,
        });
        chunks.push(...subChunks);
        currentChunk = "";
      } else {
        currentChunk = part;
      }
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  // Apply overlap between chunks
  if (chunkOverlap > 0 && chunks.length > 1) {
    return applyOverlap(chunks, chunkOverlap);
  }

  return chunks;
}

/**
 * Apply overlap between consecutive chunks.
 * Each chunk (except the first) is prepended with the tail of the previous chunk.
 * @param {string[]} chunks - Array of text chunks
 * @param {number} overlap - Number of characters to overlap
 * @returns {string[]} Chunks with overlap applied
 */
function applyOverlap(chunks, overlap) {
  const result = [chunks[0]];

  for (let i = 1; i < chunks.length; i++) {
    const prevChunk = chunks[i - 1];
    const overlapText = prevChunk.slice(-overlap);
    result.push(overlapText + " " + chunks[i]);
  }

  return result;
}

/**
 * Chunk a document into tagged pieces with metadata.
 * This is the main entry point for the chunking pipeline.
 * 
 * @param {string} text - Full document text
 * @param {Object} metadata - Document metadata
 * @param {string} metadata.sourceFile - Original filename
 * @param {Array} metadata.pages - Array of page objects [{pageNumber, text}]
 * @param {Object} options - Chunking options
 * @returns {Array<{text: string, metadata: Object}>} Tagged chunks
 */
function chunkDocument(text, metadata = {}, options = {}) {
  const { sourceFile = "unknown", pages = [] } = metadata;

  const rawChunks = splitTextRecursively(text, options);

  // Build a page offset map for PDF page attribution
  const pageOffsets = [];
  let offset = 0;
  for (const page of pages) {
    pageOffsets.push({
      pageNumber: page.pageNumber,
      start: offset,
      end: offset + page.text.length,
    });
    offset += page.text.length + 1; // +1 for newline between pages
  }

  // Tag each chunk with metadata
  return rawChunks.map((chunkText, index) => {
    // Find which page this chunk belongs to
    let pageNumber = 1;
    if (pageOffsets.length > 0) {
      const charPosition = text.indexOf(chunkText.slice(0, 50));
      for (const pageInfo of pageOffsets) {
        if (charPosition >= pageInfo.start && charPosition < pageInfo.end) {
          pageNumber = pageInfo.pageNumber;
          break;
        }
      }
    }

    return {
      text: chunkText,
      metadata: {
        chunkIndex: index,
        sourceFile,
        pageNumber,
        totalChunks: rawChunks.length,
        charCount: chunkText.length,
      },
    };
  });
}

module.exports = { chunkDocument, splitTextRecursively };
