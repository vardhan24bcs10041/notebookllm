# 📓 NotebookLM RAG — Chat With Your Documents

A full-stack **RAG (Retrieval-Augmented Generation)** application inspired by Google NotebookLM. Upload any PDF or text document and have an AI-powered conversation grounded in its content.

**Live Demo:** [Deployed on Vercel](#)  
**Tech Stack:** Next.js 15 · Google Gemini AI · In-Memory Vector Store

![RAG Pipeline](https://img.shields.io/badge/RAG-Pipeline-8b5cf6?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge)
![Gemini](https://img.shields.io/badge/Gemini-AI-3b82f6?style=for-the-badge)

---

## 🏗️ Architecture — RAG Pipeline

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  📄 Upload  │───▶│  ✂️ Chunk    │───▶│  🔢 Embed   │───▶│  💾 Store    │    │  🤖 Answer  │
│  (PDF/TXT)  │    │  (Recursive) │    │  (Gemini)   │    │  (Vector DB) │    │  (Grounded) │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘    └─────────────┘
                                                                │                    ▲
                                                                ▼                    │
                   ┌──────────────┐    ┌─────────────┐    ┌──────────────┐          │
                   │  ❓ Question │───▶│  🔢 Embed   │───▶│  🔍 Search   │──────────┘
                   │  (User)      │    │  (Query)    │    │  (Top-K)     │
                   └──────────────┘    └─────────────┘    └──────────────┘
```

### Pipeline Steps

1. **Ingestion** — User uploads a PDF or text file via drag-and-drop
2. **Chunking** — Document is split using a **Recursive Character Text Splitter** with configurable chunk size (1000 chars) and overlap (200 chars)
3. **Embedding** — Each chunk is embedded using Google's `text-embedding-004` model
4. **Storage** — Embeddings are stored in an **in-memory vector store** with cosine similarity indexing
5. **Retrieval** — User's question is embedded and compared against stored chunks using **cosine similarity**
6. **Generation** — Top-K relevant chunks are passed as context to **Gemini**, which generates a grounded answer

---

## ✂️ Chunking Strategy

The chunking module (`lib/chunker.js`) implements a **Recursive Character Text Splitter**:

- **Target chunk size:** 1000 characters (configurable)
- **Overlap:** 200 characters between consecutive chunks
- **Splitting hierarchy:** Paragraphs → Lines → Sentences → Words → Characters
- **Why recursive?** It tries the most semantically meaningful boundaries first, keeping related ideas together
- **Why overlap?** Ensures no information is lost at chunk boundaries

Each chunk is tagged with metadata:
- `chunkIndex` — Position in sequence
- `sourceFile` — Original filename
- `pageNumber` — Which PDF page the chunk came from
- `charCount` — Characters in the chunk

---

## 🔄 Automatic Model Rotation

To maximize free-tier usage, the app rotates across multiple Gemini models:

| Model | RPM | RPD | Priority |
|-------|-----|-----|----------|
| gemini-3.1-flash-lite | 15 | 500 | Primary |
| gemini-2.5-flash-lite | 10 | 20 | Secondary |
| gemini-2.5-flash | 5 | 20 | Fallback |

When a model returns a `429 Rate Limit` error, the system automatically switches to the next model. Usage is tracked per-minute for proactive rotation.

---

## 📁 Project Structure

```
assignment/
├── app/
│   ├── layout.js              # Root layout with metadata
│   ├── page.js                # Main page — upload + chat UI
│   ├── globals.css            # Design system (dark mode, glassmorphism)
│   └── api/
│       ├── upload/route.js    # POST: parse → chunk → embed → store
│       └── chat/route.js      # POST: embed query → retrieve → generate
├── lib/
│   ├── chunker.js             # Recursive text chunking with overlap
│   ├── embeddings.js          # Gemini embedding with model fallback
│   ├── vectorStore.js         # In-memory vector store (cosine similarity)
│   ├── generator.js           # Gemini LLM with auto model rotation
│   └── pdfParser.js           # PDF & text file parsing
├── components/
│   ├── Header.js              # App header/branding
│   ├── FileUpload.js          # Drag-and-drop file upload
│   ├── ChatInterface.js       # Chat messages + input
│   └── MessageBubble.js       # Message display with source citations
├── .env.example               # Environment variable template
├── next.config.mjs            # Next.js configuration
├── package.json
└── README.md                  # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A Google AI API key ([get one free](https://aistudio.google.com/apikey))

### Local Setup

```bash
# Clone the repository
git clone <repo-url>
cd assignment

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and upload a document to start chatting!

### Deploy to Vercel

1. Push your code to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add `GEMINI_API_KEY` as an environment variable
4. Deploy — it's automatic!

---

## 🛡️ Answer Grounding

The system ensures answers come **only from the document**, not from the LLM's general knowledge:

- The system prompt strictly instructs the model to only use provided context
- If the answer isn't found in the document, the model explicitly says so
- Source citations (page numbers + relevance scores) are shown with every answer
- Retrieved chunks are visible to verify grounding

---

## 🎨 Design

- **Dark mode** with ambient gradient backgrounds
- **Glassmorphism** cards with frosted glass effects
- **Micro-animations** — typing indicators, message fade-ins, floating icons
- **Responsive** — works on mobile and desktop
- **Inter** font for premium typography

---

## 📝 License

Built for academic purposes — Assignment 03, GenAI Course.
