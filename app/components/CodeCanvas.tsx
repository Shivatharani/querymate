"use client";

import { useState, useEffect, useRef } from "react";
import { X, Code, Eye, Terminal, Copy, Download, Check, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Artifact, ConsoleLog, ExecutionResult } from "@/lib/playground/types";
import { generatePreviewHtml, generateHtmlPreview, isExecutableLanguage } from "@/lib/playground/utils";

interface CodeCanvasProps {
  artifact: Artifact | null;
  onClose: () => void;
  consoleOutput: ConsoleLog[];
  onExecute?: (code: string, language: string) => Promise<ExecutionResult>;
}

type TabType = "code" | "preview" | "console";

export default function CodeCanvas({
  artifact,
  onClose,
  consoleOutput,
  onExecute,
}: CodeCanvasProps) {
  const [activeTab, setActiveTab] = useState<TabType>("preview");
  const [copied, setCopied] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  const mainFile = artifact?.files[0];
  const code = mainFile?.content || "";
  const language = mainFile?.language || artifact?.language || "jsx";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = mainFile?.path || `code.${language}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExecute = async () => {
    if (!onExecute || !code) return;
    setIsExecuting(true);
    setActiveTab("console");
    try {
      const result = await onExecute(code, language);
      setExecutionResult(result);
    } catch (error) {
      setExecutionResult({
        output: "",
        error: error instanceof Error ? error.message : "Execution failed",
        logs: [],
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const getPreviewHtml = () => {
    if (!artifact) return "";
    if (language === "html") {
      return generateHtmlPreview(code);
    }
    return generatePreviewHtml(artifact);
  };

  if (!artifact) return null;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-[200px]">
            {artifact.title || "Code Canvas"}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 uppercase font-mono">
            {language}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 w-8 p-0"
            title="Copy code"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-8 w-8 p-0"
            title="Download code"
          >
            <Download className="w-4 h-4" />
          </Button>
          {isExecutableLanguage(language) && onExecute && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExecute}
              disabled={isExecuting}
              className="h-8 w-8 p-0"
              title="Run code"
            >
              {isExecuting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
            title="Close canvas"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab("code")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "code"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <Code className="w-4 h-4" />
          Code
        </button>
        <button
          onClick={() => setActiveTab("preview")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "preview"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        <button
          onClick={() => setActiveTab("console")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "console"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <Terminal className="w-4 h-4" />
          Console
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "code" && (
          <div className="h-full overflow-auto p-4 bg-gray-50 dark:bg-gray-950">
            <pre className="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
              {code}
            </pre>
          </div>
        )}

        {activeTab === "preview" && (
          <div className="h-full bg-white">
            <iframe
              srcDoc={getPreviewHtml()}
              sandbox="allow-scripts allow-modals"
              className="w-full h-full border-0"
              title="Code Preview"
            />
          </div>
        )}

        {activeTab === "console" && (
          <div className="h-full overflow-auto p-4 bg-gray-950 font-mono text-sm">
            {isExecuting && (
              <div className="flex items-center gap-2 text-yellow-400 mb-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Running code...
              </div>
            )}
            {executionResult?.output && (
              <div className="text-green-400 whitespace-pre-wrap mb-2">
                {executionResult.output}
              </div>
            )}
            {executionResult?.error && (
              <div className="text-red-400 whitespace-pre-wrap mb-2">
                Error: {executionResult.error}
              </div>
            )}
            {executionResult?.images?.map((img, i) => (
              <img
                key={i}
                src={`data:image/png;base64,${img}`}
                alt={`Output ${i + 1}`}
                className="max-w-full my-2 rounded"
              />
            ))}
            {consoleOutput.map((log, i) => (
              <div
                key={i}
                className={`py-0.5 ${
                  log.type === "error"
                    ? "text-red-400"
                    : log.type === "warn"
                    ? "text-yellow-400"
                    : "text-gray-300"
                }`}
              >
                {log.message}
              </div>
            ))}
            {!isExecuting &&
              !executionResult &&
              consoleOutput.length === 0 && (
                <div className="text-gray-500">
                  Console output will appear here when you run code.
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

// Resizable Split Layout Component
interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  isRightVisible: boolean;
  onCloseRight: () => void;
}

export function ResizableSplit({
  left,
  right,
  isRightVisible,
  onCloseRight,
}: ResizableSplitProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [rightWidth, setRightWidth] = useState(500);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      setRightWidth(Math.max(300, Math.min(800, newWidth)));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Mobile: Full-screen overlay
  if (isMobile && isRightVisible) {
    return (
      <div className="relative h-full">
        <div className="h-full">{left}</div>
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
          <div className="absolute top-2 right-2 z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCloseRight}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          {right}
        </div>
      </div>
    );
  }

  // Desktop: Side-by-side with resizable divider
  return (
    <div ref={containerRef} className="flex h-full">
      <div className={`flex-1 min-w-0 ${isRightVisible ? "" : "w-full"}`}>
        {left}
      </div>
      {isRightVisible && (
        <>
          {/* Resize handle */}
          <div
            className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors flex-shrink-0"
            onMouseDown={handleMouseDown}
          />
          {/* Right panel */}
          <div
            style={{ width: rightWidth }}
            className="flex-shrink-0 overflow-hidden"
          >
            {right}
          </div>
        </>
      )}
    </div>
  );
}