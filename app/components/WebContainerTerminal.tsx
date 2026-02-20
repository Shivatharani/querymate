"use client";

import { useEffect, useRef, useState } from "react";
import { WebContainer } from "@webcontainer/api";

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

interface Props {
  files: { path: string; content: string }[];
}

export default function WebContainerTerminal({ files }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  // 🟢 Use first file as entry point
  const entryFile = files?.[0];

  useEffect(() => {
    const init = async () => {
      if (!bootPromise) {
        bootPromise = WebContainer.boot();
      }

      webcontainerInstance = await bootPromise;
      const wc = webcontainerInstance;

      if (terminalRef.current) {
        terminalRef.current.innerText = "";
      }

      const fileTree: any = {};

      files.forEach((file) => {
        fileTree[file.path] = {
          file: {
            contents: file.content,
          },
        };
      });

      if (!fileTree["package.json"]) {
        fileTree["package.json"] = {
          file: {
            contents: JSON.stringify({
              name: "app",
              type: "module",
              dependencies: {},
            }),
          },
        };
      }

      await wc.mount(fileTree);
      setIsReady(true);
    };

    if (files?.length) {
      init();
    }
  }, [files]);

  const runCommand = async (cmd: string) => {
    if (!webcontainerInstance || !terminalRef.current) return;

    terminalRef.current.innerText += `\n$ ${cmd}\n`;

    const process = await webcontainerInstance.spawn("sh", ["-c", cmd]);
    const reader = process.output.getReader();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      terminalRef.current.innerText += value;
    }
  };

  const runApp = async () => {
    if (!entryFile) {
      if (terminalRef.current) {
        terminalRef.current.innerText += "\nNo entry file found.\n";
      }
      return;
    }

    await runCommand(`node ${entryFile.path}`);
  };

  return (
    <div className="h-full flex flex-col bg-black text-green-400 text-sm font-mono">
      <div className="p-2 border-b border-gray-700">
        WebContainer Terminal
      </div>

      <div
        ref={terminalRef}
        className="flex-1 p-3 overflow-auto whitespace-pre-wrap"
      />

      {isReady && (
        <div className="p-2 border-t border-gray-700 flex gap-2">
          <button
            onClick={runApp}
            className="bg-green-700 px-3 py-1 rounded"
          >
            ▶ Run App
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.elements.namedItem(
                "cmd"
              ) as HTMLInputElement).value;

              if (!input) return;

              runCommand(input);
              e.currentTarget.reset();
            }}
            className="flex gap-2 flex-1"
          >
            <input
              name="cmd"
              placeholder="Type command (npm install, node file.js)"
              className="flex-1 bg-gray-900 text-green-400 px-2 py-1 outline-none"
            />
            <button
              type="submit"
              className="bg-gray-800 px-3 py-1 rounded"
            >
              Run
            </button>
          </form>
        </div>
      )}
    </div>
  );
}