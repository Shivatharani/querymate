"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Code,
  Eye,
  Terminal,
  Copy,
  Download,
  Check,
  Play,
  Loader2,
  Github,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Artifact,
  ConsoleLog,
  ExecutionResult,
} from "@/lib/playground/types";
import {
  generatePreviewHtml,
  generateHtmlPreview,
  isExecutableLanguage,
} from "@/lib/playground/utils";
import { GitHubSuccessDialog } from "@/components/ui/github-success-dialog";

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
  const [executionResult, setExecutionResult] =
    useState<ExecutionResult | null>(null);

  /* ---------------- GitHub state ---------------- */
  const [selectedRepo, setSelectedRepo] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");

  const mainFile = artifact?.files[0];
  const code = mainFile?.content || "";
  const language = mainFile?.language || artifact?.language || "jsx";

  if (!artifact) return null;

  /* ---------------- Basic actions ---------------- */

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
    a.click();
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
        error:
          error instanceof Error ? error.message : "Execution failed",
        logs: [],
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const getPreviewHtml = () => {
    if (language === "html") return generateHtmlPreview(code);
    return generatePreviewHtml(artifact);
  };

  /* ---------------- GitHub publish logic ---------------- */

  const createRepoAndPublish = async () => {
  setIsSaving(true);

  // 1️⃣ Create repo
  const projectName =
  artifact?.title ||
  mainFile?.path ||
  `project-${language}`;

const repoRes = await fetch("/api/github/create-repo", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    suggestedName: projectName,
  }),
});

  

  if (!repoRes.ok) {
    setIsSaving(false);
    throw new Error("Failed to create GitHub repository");
  }

  const repo = await repoRes.json();
  setSelectedRepo(repo);

  // 2️⃣ Commit ALL files from artifact
  const files = artifact?.files ?? [];

  for (const file of files) {
    await fetch("/api/github/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: repo.owner,
        repo: repo.repoName,
        path: file.path || `index.${file.language || "txt"}`,
        content: file.content,
        message: `Add ${file.path || "file"} from QueryMate`,
      }),
    });
  }

  // 3️⃣ Notify user + open repo
  setRepoUrl(repo.url);
setShowGitHubDialog(true);


  setIsSaving(false);
};


  const saveToGitHub = async () => {
  if (!selectedRepo) return;

  setIsSaving(true);

  const files = artifact?.files ?? [];

  for (const file of files) {
    await fetch("/api/github/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: selectedRepo.owner,
        repo: selectedRepo.repoName,
        path: file.path || `index.${file.language || "txt"}`,
        content: file.content,
        message: `Update ${file.path || "file"} via QueryMate`,
      }),
    });
  }

  setRepoUrl(selectedRepo.url);
setShowGitHubDialog(true);


  setIsSaving(false);
};

  const handleGitHubClick = async () => {
  const res = await fetch("/api/github/status");
  const status = await res.json();

  // 1️⃣ Not connected → OAuth
  if (!status.connected) {
    window.location.href = "/api/github/auth";
    return;
  }

  // 2️⃣ Connected but no repo → create + publish
  if (status.connected && !selectedRepo) {
    await createRepoAndPublish();
    return;
  }

  // 3️⃣ Repo exists → update files
  await saveToGitHub();
};


  /* ---------------- UI ---------------- */

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-l">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4" />
          <span className="font-medium text-sm truncate max-w-[200px]">
            {artifact.title || "Code Canvas"}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-600 font-mono">
            {language}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGitHubClick}
            title="Publish to GitHub"
            disabled={isSaving}
            className="h-8 w-8 p-0"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Github className="w-4 h-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 w-8 p-0"
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
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {["code", "preview", "console"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as TabType)}
            className={`px-4 py-2 text-sm border-b-2 ${
              activeTab === tab
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500"
            }`}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "code" && (
          <pre className="h-full p-4 text-sm font-mono overflow-auto">
            {code}
          </pre>
        )}

        {activeTab === "preview" && (
          <iframe
            srcDoc={getPreviewHtml()}
            className="w-full h-full border-0"
          />
        )}

        {activeTab === "console" && (
          <div className="h-full p-4 font-mono text-sm bg-black text-white overflow-auto">
            {executionResult?.output}
            {consoleOutput.map((log, i) => (
              <div key={i}>{log.message}</div>
            ))}
          </div>
        )}
      </div>
      <GitHubSuccessDialog
  open={showGitHubDialog}
  onOpenChange={setShowGitHubDialog}
  repoUrl={repoUrl}
  title="GitHub Publish Successful"
  description="Your project has been pushed to GitHub successfully."
/>

    </div>
  );
}

/* ---------------- ResizableSplit ---------------- */

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
  const [rightWidth, setRightWidth] = useState(500);
  const isDragging = useRef(false);

  const handleMouseDown = () => {
    isDragging.current = true;

    const onMove = (e: MouseEvent) =>
      isDragging.current && setRightWidth((w) => w - e.movementX);
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1">{left}</div>
      {isRightVisible && (
        <>
          <div
            className="w-1 bg-gray-300 cursor-col-resize"
            onMouseDown={handleMouseDown}
          />
          <div style={{ width: rightWidth }}>{right}</div>
        </>
      )}
    </div>
  );
}