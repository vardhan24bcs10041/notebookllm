"use client";

export default function Header() {
  return (
    <header className="header" id="app-header">
      <div className="header-brand">
        <div className="header-logo">N</div>
        <div>
          <div className="header-title">
            Notebook<span>LM</span>
          </div>
          <div className="header-subtitle">RAG Pipeline</div>
        </div>
      </div>
      <div className="header-badge">✨ AI-Powered Document Chat</div>
    </header>
  );
}
