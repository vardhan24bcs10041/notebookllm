"use client";

import { useState, useRef } from "react";

const PIPELINE_STEPS = [
  { id: "parse", label: "Parsing document", icon: "📄" },
  { id: "chunk", label: "Chunking text", icon: "✂️" },
  { id: "embed", label: "Generating embeddings", icon: "🔢" },
  { id: "store", label: "Storing in vector DB", icon: "💾" },
];

export default function FileUpload({ onUploadComplete, documentInfo }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(-1);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file) => {
    setError(null);

    // Validate file type
    const ext = file.name.toLowerCase().split(".").pop();
    if (!["pdf", "txt", "md", "text"].includes(ext)) {
      setError("Unsupported file type. Please upload a PDF or TXT file.");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum size is 10MB.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate pipeline progress
    const progressSteps = [
      { step: 0, progress: 15 },
      { step: 1, progress: 35 },
      { step: 2, progress: 65 },
      { step: 3, progress: 85 },
    ];

    // Start progress animation
    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      if (stepIndex < progressSteps.length) {
        setCurrentStep(progressSteps[stepIndex].step);
        setUploadProgress(progressSteps[stepIndex].progress);
        stepIndex++;
      }
    }, 800);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setUploadProgress(100);
      setCurrentStep(4); // all done

      // Notify parent
      onUploadComplete({
        sessionId: data.sessionId,
        documentInfo: data.documentInfo,
        chunkCount: data.chunkCount,
      });
    } catch (err) {
      clearInterval(progressInterval);
      setError(err.message);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleNewDocument = () => {
    setUploadProgress(0);
    setCurrentStep(-1);
    setError(null);
    onUploadComplete(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  return (
    <div className="sidebar" id="upload-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">📁 Documents</div>
        <div className="sidebar-desc">
          Upload a PDF or text file to start chatting
        </div>
      </div>

      <div className="sidebar-content">
        {/* Show upload zone if no document */}
        {!documentInfo && !isUploading && (
          <div
            className={`upload-zone ${isDragOver ? "drag-over" : ""}`}
            id="upload-dropzone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="upload-icon">📄</div>
            <div className="upload-text">
              Drop your file here or <span>browse</span>
            </div>
            <div className="upload-hint">PDF, TXT, MD — Max 10MB</div>
            <input
              ref={fileInputRef}
              type="file"
              className="upload-input"
              accept=".pdf,.txt,.md,.text"
              onChange={handleFileSelect}
              id="file-input"
            />
          </div>
        )}

        {/* Upload progress */}
        {isUploading && (
          <div className="upload-progress">
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="progress-text">
              Processing document... {uploadProgress}%
            </div>

            <div className="pipeline-steps">
              {PIPELINE_STEPS.map((step, i) => (
                <div
                  key={step.id}
                  className={`pipeline-step ${
                    i === currentStep
                      ? "active"
                      : i < currentStep
                      ? "done"
                      : ""
                  }`}
                >
                  <div className="step-icon">
                    {i < currentStep ? "✓" : step.icon}
                  </div>
                  {step.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Document info */}
        {documentInfo && !isUploading && (
          <div className="doc-info" id="document-info">
            <div className="doc-info-header">
              <div className="doc-info-icon">
                {documentInfo.filename?.endsWith(".pdf") ? "📕" : "📝"}
              </div>
              <div>
                <div className="doc-info-name">{documentInfo.filename}</div>
                <div className="doc-info-size">
                  {formatFileSize(documentInfo.size)}
                </div>
              </div>
            </div>

            <div className="doc-stats">
              <div className="doc-stat">
                <div className="doc-stat-value">
                  {documentInfo.pageCount}
                </div>
                <div className="doc-stat-label">Pages</div>
              </div>
              <div className="doc-stat">
                <div className="doc-stat-value">
                  {documentInfo.chunkCount}
                </div>
                <div className="doc-stat-label">Chunks</div>
              </div>
            </div>

            <button
              className="new-doc-btn"
              onClick={handleNewDocument}
              id="new-doc-button"
            >
              ↑ Upload New Document
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-toast" style={{ position: "relative", bottom: "auto", left: "auto", transform: "none", marginTop: "12px" }}>
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  );
}
