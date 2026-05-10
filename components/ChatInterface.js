"use client";

import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";

const SUGGESTIONS = [
  "What is this document about?",
  "Summarize the key points",
  "What are the main topics covered?",
  "Explain the most important concept",
];

export default function ChatInterface({ sessionId, hasDocument, documentData }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Clear messages when session changes (new document uploaded)
  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [sessionId]);

  const sendMessage = async (text) => {
    const question = text || input.trim();
    if (!question || isLoading || !sessionId) return;

    setError(null);
    setInput("");

    // Add user message
    const userMsg = {
      id: Date.now(),
      role: "user",
      content: question,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question, 
          sessionId,
          chunks: documentData?.chunks,
          embeddings: documentData?.embeddings 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get answer");
      }

      // Add AI response
      const aiMsg = {
        id: Date.now() + 1,
        role: "ai",
        content: data.answer,
        sources: data.sources,
        model: data.model,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setError(err.message);
      // Add error message as AI response
      const errMsg = {
        id: Date.now() + 1,
        role: "ai",
        content: `Sorry, I encountered an error: ${err.message}`,
        sources: [],
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    sendMessage(suggestion);
  };

  return (
    <div className="chat-panel" id="chat-panel">
      {/* Empty state */}
      {messages.length === 0 && !isLoading && (
        <div className="chat-empty">
          <div className="empty-icon">💬</div>
          <div className="empty-title">
            {hasDocument
              ? "Ask anything about your document"
              : "Upload a document to get started"}
          </div>
          <div className="empty-desc">
            {hasDocument
              ? "Your document has been processed and indexed. Ask questions and get answers grounded in its content."
              : "Drop a PDF or text file in the sidebar, and I'll help you explore its contents with AI-powered search."}
          </div>

          {hasDocument && (
            <div className="suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick(s)}
                  id={`suggestion-${i}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="chat-messages" id="chat-messages">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="typing-indicator">
              <div className="message-avatar" style={{
                background: "var(--bg-glass)",
                border: "1px solid var(--border-subtle)",
                width: 32, height: 32, borderRadius: "var(--radius-sm)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14
              }}>
                🤖
              </div>
              <div className="typing-dots">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input */}
      <div className="chat-input-container" id="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder={
              hasDocument
                ? "Ask a question about your document..."
                : "Upload a document first..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!hasDocument || isLoading}
            rows={1}
            id="chat-input"
          />
          <button
            className="send-btn"
            onClick={() => sendMessage()}
            disabled={!input.trim() || !hasDocument || isLoading}
            id="send-button"
          >
            ➤
          </button>
        </div>
        <div className="input-hint">
          {hasDocument
            ? "Press Enter to send · Shift+Enter for new line"
            : "Upload a PDF or TXT file to begin"}
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="error-toast" onClick={() => setError(null)}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
