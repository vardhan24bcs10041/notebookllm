import "./globals.css";

export const metadata = {
  title: "NotebookLM RAG — Chat With Your Documents",
  description:
    "Upload any PDF or text document and have an AI-powered conversation grounded in its content. Built with a full RAG pipeline: chunking, embedding, retrieval, and generation.",
  keywords: ["RAG", "NotebookLM", "AI", "document chat", "vector search"],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#06060e" />
      </head>
      <body>{children}</body>
    </html>
  );
}
