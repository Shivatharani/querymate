"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, RefreshCw, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  bootWebContainer,
  mountProject,
  runNpmInstall,
  startDevServer,
  type LogCallback,
} from "@/lib/playground/webcontainer";

type Phase = "idle" | "booting" | "installing" | "starting" | "ready" | "error";

interface Props {
  code: string;
  language: string;
  title?: string;
}

export default function WebContainerPreview({ code, language, title }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isStartingRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const addLog = useCallback<LogCallback>((line) => {
    setLogs((prev) => [...prev, line]);
  }, []);

  // Auto-scroll console
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  /** Full lifecycle: boot → mount → install → dev server */
  const startPreview = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    setPhase("booting");
    setError(null);
    setServerUrl(null);
    setLogs([]);

    try {
      addLog("⚡ Booting WebContainer...");
      const wc = await bootWebContainer();
      addLog("✅ WebContainer ready");

      setPhase("installing");
      addLog("📦 Mounting project files...");
      await mountProject(wc, { code, language });
      addLog("✅ Files mounted");

      addLog("📦 Running npm install...");
      const exitCode = await runNpmInstall(wc, addLog);

      if (exitCode !== 0) {
        throw new Error(`npm install exited with code ${exitCode}`);
      }
      addLog("✅ Dependencies installed");

      setPhase("starting");
      addLog("🚀 Starting dev server...");
      const url = await startDevServer(wc, addLog);
      addLog(`✅ Server ready at ${url}`);

      setServerUrl(url);
      setPhase("ready");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      addLog(`❌ Error: ${msg}`);
      setError(msg);
      setPhase("error");
    } finally {
      isStartingRef.current = false;
    }
  }, [code, language, addLog]);

  // Auto-start on mount
  useEffect(() => {
    startPreview();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When code changes, re-mount and refresh
  const prevCodeRef = useRef(code);
  useEffect(() => {
    if (prevCodeRef.current !== code && phase === "ready") {
      prevCodeRef.current = code;
      // Hot-update: just remount files and let Vite HMR refresh
      (async () => {
        try {
          const wc = await bootWebContainer();
          await mountProject(wc, { code, language });
          addLog("🔄 Files updated (Vite HMR will refresh)");
          // Force iframe refresh after a brief delay for HMR
          setTimeout(() => {
            if (iframeRef.current && serverUrl) {
              iframeRef.current.src = serverUrl;
            }
          }, 500);
        } catch {
          addLog("⚠️ Failed to update files");
        }
      })();
    }
  }, [code, language, phase, serverUrl, addLog]);

  /* ---------- phase labels ---------- */

  const phaseLabel: Record<Phase, string> = {
    idle: "Initializing...",
    booting: "Booting WebContainer...",
    installing: "Installing packages...",
    starting: "Starting dev server...",
    ready: "Running",
    error: "Error",
  };

  const phaseColor: Record<Phase, string> = {
    idle: "text-gray-400",
    booting: "text-blue-400",
    installing: "text-yellow-400",
    starting: "text-orange-400",
    ready: "text-green-400",
    error: "text-red-400",
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-900/80">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              phase === "ready"
                ? "bg-green-500 animate-pulse"
                : phase === "error"
                  ? "bg-red-500"
                  : "bg-yellow-500 animate-pulse"
            }`}
          />
          <span className={`text-xs font-medium ${phaseColor[phase]}`}>
            {phaseLabel[phase]}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {phase === "error" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={startPreview}
              className="h-7 text-xs text-gray-400 hover:text-white gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          )}
          {phase === "ready" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (iframeRef.current && serverUrl) {
                  iframeRef.current.src = serverUrl;
                }
              }}
              className="h-7 text-xs text-gray-400 hover:text-white gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Main area: iframe when ready, console otherwise */}
      <div className="flex-1 relative overflow-hidden">
        {/* Preview iframe - shown when server is ready */}
        {serverUrl && phase === "ready" && (
          <iframe
            ref={iframeRef}
            src={serverUrl}
            className="w-full h-full border-0 bg-white"
            title={title || "Preview"}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        )}

        {/* Console output - shown during boot/install/error */}
        {phase !== "ready" && (
          <div className="h-full flex flex-col">
            {/* Loading spinner overlay */}
            {phase !== "error" && (
              <div className="flex items-center justify-center py-6">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="text-sm text-gray-400">{phaseLabel[phase]}</span>
                </div>
              </div>
            )}

            {/* Console logs */}
            <div className="flex-1 overflow-auto px-3 py-2">
              <div className="flex items-center gap-1.5 mb-2">
                <Terminal className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Console
                </span>
              </div>
              <div className="font-mono text-xs space-y-0.5">
                {logs.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.startsWith("❌")
                        ? "text-red-400"
                        : line.startsWith("✅")
                          ? "text-green-400"
                          : line.startsWith("⚠️")
                            ? "text-yellow-400"
                            : line.startsWith("📦") || line.startsWith("🚀") || line.startsWith("⚡")
                              ? "text-blue-400"
                              : "text-gray-400"
                    }
                  >
                    {line}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* Error state */}
            {error && (
              <div className="px-3 py-3 border-t border-red-900/50 bg-red-950/30">
                <p className="text-xs text-red-400 font-mono">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startPreview}
                  className="mt-2 h-7 text-xs border-red-800 text-red-400 hover:bg-red-900/30"
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Retry
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}