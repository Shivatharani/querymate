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
  Maximize2,
  Minimize2,
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

import StackBlitzEmbed from "./StackBlitzEmbed";

interface CodeCanvasProps {
  artifact: Artifact | null;
  onClose: () => void;
  consoleOutput: ConsoleLog[];
  onExecute?: (code: string, language: string) => Promise<ExecutionResult>;
}

type TabType = "code" | "preview" | "console" | "stackblitz";

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

  const [dialogType, setDialogType] = useState<"created" | "updated">("created");


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
    // If it's a web tech, use StackBlitz
    if (["javascript", "typescript", "html", "css"].includes(language.toLowerCase())) {
      setActiveTab("stackblitz");
      return;
    }

    // Otherwise use backend execution API (like Python)
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
    setDialogType("created");



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
    setDialogType("updated");



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
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <Code className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-gray-600 dark:text-gray-400" />
          <span className="font-medium text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[200px] text-gray-900 dark:text-gray-100">
            {artifact.title || "Code Canvas"}
          </span>
          <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-mono flex-shrink-0">
            {language}
          </span>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGitHubClick}
            title="Publish to GitHub"
            disabled={isSaving}
            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
            ) : (
              <Github className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 w-7 sm:h-8 sm:w-8 p-0 hidden sm:flex"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>

          {isExecutableLanguage(language) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExecute}
              disabled={isExecuting}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
              title={["javascript", "typescript", "html", "css"].includes(language.toLowerCase()) ? "Run in StackBlitz" : "Run Code"}
            >
              {isExecuting ? (
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-green-500" />
              ) : (
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
              )}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {["code", "preview", "console", "stackblitz"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as TabType)}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors ${activeTab === tab
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">

        {activeTab === "code" && (
          <pre className="h-full p-2 sm:p-4 text-xs sm:text-sm font-mono overflow-auto bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
            {code}
          </pre>
        )}

        {activeTab === "preview" && (
          <iframe
            srcDoc={getPreviewHtml()}
            className="w-full h-full border-0 bg-white"
          />
        )}

        {activeTab === "console" && (
          <div className="h-full p-2 sm:p-4 font-mono text-xs sm:text-sm bg-gray-950 text-green-400 overflow-auto">
            {executionResult?.error && (
              <div className="text-red-400 mb-2">
                {executionResult.error}
              </div>
            )}
            {executionResult?.output}
            {consoleOutput.map((log, i) => (
              <div key={i} className={log.type === "error" ? "text-red-400" : ""}>
                {log.message}
              </div>
            ))}
            {!executionResult && consoleOutput.length === 0 && (
              <div className="text-gray-500">
                No output yet. Click Run to execute code.
              </div>
            )}
          </div>
        )}

        {activeTab === "stackblitz" && (
          <div className="h-full">
            <StackBlitzEmbed
              template={language === "html" ? "html" : "node"}
              files={artifact.files.map((f) => ({
                path: f.path || `index.${language}`,
                content: f.content,
              }))}
              title={artifact.title || "QueryMate Code"}
            />
          </div>
        )}
      </div>
      <GitHubSuccessDialog
        open={showGitHubDialog}
        onOpenChange={setShowGitHubDialog}
        repoUrl={repoUrl}
        title={
          dialogType === "created"
            ? "Repository Created Successfully"
            : "Repository Updated Successfully"
        }
        description={
          dialogType === "created"
            ? "Your project has been pushed to GitHub."
            : "Your existing repository has been updated."
        }
      />


    </div>
  );
}

/* ---------------- ResizableSplit ---------------- */

interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  isRightVisible: boolean;
  hasContent?: boolean; // Whether there's actual content to show (e.g., artifact)
  onCloseRight: () => void;
}

export function ResizableSplit({
  left,
  right,
  isRightVisible,
  hasContent = false,
  onCloseRight,
}: ResizableSplitProps) {
  const [rightWidth, setRightWidth] = useState(500);
  const [isMobile, setIsMobile] = useState(false);
  const isDragging = useRef(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleMouseDown = () => {
    isDragging.current = true;

    const onMove = (e: MouseEvent) =>
      isDragging.current && setRightWidth((w) => Math.max(280, Math.min(w - e.movementX, window.innerWidth - 400)));
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Mobile: Only show full-screen overlay when there's actual content
  if (isMobile) {
    return (
      <div className="flex h-full relative">
        <div className="flex-1 h-full">{left}</div>
        {isRightVisible && hasContent && (
          <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
            {right}
          </div>
        )}
      </div>
    );
  }

  // Desktop: Side-by-side with resizable divider
  return (
    <div className="flex h-full">
      <div className={`flex-1 min-w-0 transition-all duration-200 ${isRightVisible ? "" : ""}`}>
        {left}
      </div>
      {isRightVisible && (
        <>
          <div
            className="w-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 cursor-col-resize transition-colors flex-shrink-0"
            onMouseDown={handleMouseDown}
          />
          <div
            style={{ width: rightWidth }}
            className="flex-shrink-0 h-full overflow-hidden"
          >
            {right}
          </div>
        </>
      )}
    </div>

  );
}