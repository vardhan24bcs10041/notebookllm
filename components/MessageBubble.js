"use client";

export default function MessageBubble({ message }) {
  const { role, content, sources, model } = message;
  const isUser = role === "user";

  return (
    <div className={`message ${isUser ? "user" : "ai"}`} id={`message-${message.id}`}>
      <div className="message-avatar">
        {isUser ? "👤" : "🤖"}
      </div>
      <div className="message-content">
        <div className="message-text">{content}</div>

        {/* Show sources for AI messages */}
        {!isUser && sources && sources.length > 0 && (
          <div className="message-sources">
            <div className="sources-label">📎 Sources</div>
            <div className="source-tags">
              {sources.map((source, i) => (
                <span key={i} className="source-tag">
                  Page {source.pageNumber} · {source.relevance}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Show model used */}
        {!isUser && model && (
          <div className="model-badge">⚡ {model}</div>
        )}
      </div>
    </div>
  );
}
