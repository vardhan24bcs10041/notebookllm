/**
 * Document Parser Module
 * 
 * Handles parsing of PDF and plain text files.
 * Extracts text content and page-level metadata.
 * 
 * Supported formats:
 * - PDF (.pdf) — parsed using pdf-parse library
 * - Plain text (.txt) — read directly
 */
// pdf-parse is required dynamically inside parsePDF to prevent Vercel initialization crashes
/**
 * Parse a PDF file buffer into structured text with page info.
 * 
 * @param {Buffer} buffer - PDF file buffer
 * @param {string} filename - Original filename
 * @returns {Promise<{text: string, pages: Array, metadata: Object}>}
 */
async function parsePDF(buffer, filename) {
  try {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);

    // pdf-parse gives us the full text — we also extract per-page text
    // by using the custom page renderer
    const pages = [];
    const pageTexts = data.text.split(/\f/); // Form feed separates pages in pdf-parse output

    pageTexts.forEach((pageText, index) => {
      if (pageText.trim().length > 0) {
        pages.push({
          pageNumber: index + 1,
          text: pageText.trim(),
        });
      }
    });

    // If page splitting didn't work well, treat entire text as page 1
    if (pages.length === 0) {
      pages.push({
        pageNumber: 1,
        text: data.text.trim(),
      });
    }

    return {
      text: data.text,
      pages,
      metadata: {
        filename,
        pageCount: data.numpages || pages.length,
        info: data.info,
        charCount: data.text.length,
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse PDF "${filename}": ${error.message}`);
  }
}

/**
 * Parse a plain text file buffer.
 * 
 * @param {Buffer} buffer - Text file buffer
 * @param {string} filename - Original filename
 * @returns {Promise<{text: string, pages: Array, metadata: Object}>}
 */
async function parseText(buffer, filename) {
  const text = buffer.toString("utf-8");

  return {
    text,
    pages: [
      {
        pageNumber: 1,
        text: text.trim(),
      },
    ],
    metadata: {
      filename,
      pageCount: 1,
      charCount: text.length,
    },
  };
}

/**
 * Parse a document buffer based on file type.
 * 
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename (used to detect type)
 * @returns {Promise<{text: string, pages: Array, metadata: Object}>}
 */
async function parseDocument(buffer, filename) {
  const extension = filename.toLowerCase().split(".").pop();

  switch (extension) {
    case "pdf":
      return parsePDF(buffer, filename);
    case "txt":
    case "md":
    case "text":
      return parseText(buffer, filename);
    default:
      throw new Error(
        `Unsupported file type: .${extension}. Supported: .pdf, .txt, .md`
      );
  }
}

module.exports = { parseDocument, parsePDF, parseText };
