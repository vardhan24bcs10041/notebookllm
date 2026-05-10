"use client";

import { useState } from "react";
import Header from "@/components/Header";
import FileUpload from "@/components/FileUpload";
import ChatInterface from "@/components/ChatInterface";

export default function Home() {
  const [sessionId, setSessionId] = useState(null);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [documentData, setDocumentData] = useState({ chunks: null, embeddings: null });

  const handleUploadComplete = (result) => {
    if (result === null) {
      // New document requested — reset
      setSessionId(null);
      setDocumentInfo(null);
      setDocumentData({ chunks: null, embeddings: null });
      return;
    }

    setSessionId(result.sessionId);
    setDocumentInfo({
      ...result.documentInfo,
      chunkCount: result.chunkCount,
    });
    setDocumentData({
      chunks: result.chunks,
      embeddings: result.embeddings,
    });
  };

  return (
    <div className="app-container" id="app-root">
      <Header />
      <main className="main-content">
        <FileUpload
          onUploadComplete={handleUploadComplete}
          documentInfo={documentInfo}
        />
        <ChatInterface
          sessionId={sessionId}
          hasDocument={!!documentInfo}
          documentData={documentData}
        />
      </main>
    </div>
  );
}
