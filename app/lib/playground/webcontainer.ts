/**
 * WebContainer singleton management utility.
 *
 * Key constraints:
 *  - Only ONE WebContainer instance per page (throws if you try a second boot).
 *  - Instance persisted on `window` so it survives React HMR remounts.
 *  - Boot promise also persisted to handle concurrent boot attempts.
 */

import { WebContainer } from "@webcontainer/api";

/* ---------- global typings for window persistence ---------- */

declare global {
  interface Window {
    __wc_instance?: WebContainer;
    __wc_boot_promise?: Promise<WebContainer>;
  }
}

/* ---------- ANSI stripping ---------- */

/**
 * Strip ALL ANSI escape codes, carriage returns, and cursor control sequences.
 */
export function stripAnsi(text: string): string {
  return text
    // Standard CSI sequences: ESC [ ... letter
    .replace(/\x1B\[[0-9;]*[A-Za-z]/g, "")
    // OSC sequences: ESC ] ... BEL or ESC ] ... ESC \
    .replace(/\x1B\].*?(\x07|\x1B\\)/g, "")
    // Character set sequences: ESC ( A, ESC ) B etc.
    .replace(/\x1B[()][AB012]/g, "")
    // Private mode: ESC [ ? ... h/l
    .replace(/\x1B\[\?[0-9;]*[hl]/g, "")
    // Raw ESC followed by any single char
    .replace(/\x1B./g, "")
    // Carriage returns
    .replace(/\r/g, "")
    // Backslash-forward slash artifacts from npm progress
    .replace(/[/\\|]\s*$/gm, "")
    // Spinner chars
    .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, "")
    // Multiple newlines → single
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ---------- boot ---------- */

export async function bootWebContainer(): Promise<WebContainer> {
  // 1. Already booted – reuse
  if (typeof window !== "undefined" && window.__wc_instance) {
    return window.__wc_instance;
  }

  // 2. Boot in-progress – wait for it
  if (typeof window !== "undefined" && window.__wc_boot_promise) {
    return window.__wc_boot_promise;
  }

  // 3. First boot
  const promise = WebContainer.boot().then((wc) => {
    if (typeof window !== "undefined") {
      window.__wc_instance = wc;
    }
    return wc;
  });

  if (typeof window !== "undefined") {
    window.__wc_boot_promise = promise;
  }

  return promise;
}

/* ---------- dependency detection ---------- */

/**
 * Parse `import … from "pkg"` statements and `// DEPENDENCIES:` comment.
 * Returns unique package names. Skips react/react-dom.
 */
export function detectDependencies(code: string): string[] {
  const deps = new Set<string>();

  // 1. Parse `// DEPENDENCIES: pkg1, pkg2, pkg3` comment (first line or anywhere)
  const depsComment = code.match(/\/\/\s*DEPENDENCIES:\s*(.+)/i);
  if (depsComment) {
    depsComment[1]
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean)
      .forEach((d) => deps.add(d));
  }

  // 2. Parse import statements
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"./][^'"]*)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(code)) !== null) {
    let pkg = match[1];
    // Normalise: "lodash/merge" → "lodash", "@org/pkg/foo" → "@org/pkg"
    if (pkg.startsWith("@")) {
      pkg = pkg.split("/").slice(0, 2).join("/");
    } else {
      pkg = pkg.split("/")[0];
    }
    deps.add(pkg);
  }

  // Remove built-ins provided by Vite / React template
  const builtins = new Set(["react", "react-dom", "react/jsx-runtime"]);
  builtins.forEach((b) => deps.delete(b));

  return [...deps];
}

/**
 * Check whether code uses Tailwind CSS class names.
 */
export function usesTailwind(code: string): boolean {
  return /className\s*=/.test(code);
}

/* ---------- component wrapping ---------- */

/**
 * Ensure the code has a default export.
 * If missing, find the first top-level function component and append
 * `export default ComponentName;`.
 */
export function wrapComponent(code: string): string {
  // Remove the DEPENDENCIES comment line (it's not valid JS)
  let cleaned = code.replace(/\/\/\s*DEPENDENCIES:.*\n?/i, "");

  if (/export\s+default\s/.test(cleaned)) return cleaned;

  // Look for common component names
  const funcMatch = cleaned.match(
    /(?:function|const)\s+(App|Main|Component|Home|Page|Calculator|Counter|Dashboard|Todo|TodoApp|Game|Clock|Timer|Weather|Form|Card|Modal|Layout|Navbar|Sidebar|Footer|Header|Hero)\b/
  );

  if (funcMatch) {
    return cleaned + `\nexport default ${funcMatch[1]};\n`;
  }

  // Fallback: wrap the whole thing in an App function
  return `function App() {\n  return (\n    <>\n${cleaned}\n    </>\n  );\n}\nexport default App;\n`;
}

/* ---------- check if code needs npm packages ---------- */

/**
 * Returns true if the code imports any package that won't work in Fast (CDN) mode.
 * Fast mode only supports: react, react-dom (provided by CDN).
 */
export function needsNpmPackages(code: string): boolean {
  const deps = detectDependencies(code);
  return deps.length > 0;
}

/* ---------- file mounting ---------- */

export interface MountFiles {
  code: string;
  language: string;
  title?: string;
}

/**
 * Build the virtual file tree for Vite + React and mount it into the
 * WebContainer. Returns the container so callers can start processes.
 */
export async function mountProject(
  wc: WebContainer,
  { code, language }: MountFiles,
): Promise<void> {
  const deps = detectDependencies(code);
  const needsTailwind = usesTailwind(code);

  const componentCode = wrapComponent(code);

  // Determine file extension
  const ext = ["tsx", "typescript"].includes(language.toLowerCase())
    ? "tsx"
    : "jsx";

  const packageJson: Record<string, unknown> = {
    name: "querymate-preview",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
    },
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      ...Object.fromEntries(deps.map((d) => [d, "latest"])),
      ...(needsTailwind ? { tailwindcss: "^3.4.0", postcss: "^8.4.35", autoprefixer: "^10.4.17" } : {}),
    },
    devDependencies: {
      "@vitejs/plugin-react": "^4.2.1",
      vite: "^5.1.0",
      ...(ext === "tsx"
        ? { typescript: "^5.3.3", "@types/react": "^18.2.48", "@types/react-dom": "^18.2.18" }
        : {}),
    },
  };

  const viteConfig = `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173 },
});
`;

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  <link rel="stylesheet" href="/src/index.css" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.${ext}"></script>
</body>
</html>`;

  const mainFile = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;

  const indexCss = needsTailwind
    ? `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n* { box-sizing: border-box; }\nbody { margin: 0; font-family: system-ui, -apple-system, sans-serif; }\n`
    : `* { box-sizing: border-box; }\nbody { margin: 0; font-family: system-ui, -apple-system, sans-serif; }\n`;

  const tailwindConfig = needsTailwind
    ? `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
`
    : null;

  const postcssConfig = needsTailwind
    ? `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`
    : null;

  // Build file tree
  const tree: Record<string, any> = {
    "package.json": { file: { contents: JSON.stringify(packageJson, null, 2) } },
    "vite.config.js": { file: { contents: viteConfig } },
    "index.html": { file: { contents: indexHtml } },
    src: {
      directory: {
        [`main.${ext}`]: { file: { contents: mainFile } },
        [`App.${ext}`]: { file: { contents: componentCode } },
        "index.css": { file: { contents: indexCss } },
      },
    },
  };

  if (tailwindConfig) {
    tree["tailwind.config.js"] = { file: { contents: tailwindConfig } };
  }
  if (postcssConfig) {
    tree["postcss.config.js"] = { file: { contents: postcssConfig } };
  }

  await wc.mount(tree);
}

/* ---------- run processes ---------- */

export type LogCallback = (line: string) => void;

/**
 * Run `npm install` inside the WebContainer.
 * Pipes stdout/stderr to the provided callback after stripping ANSI codes.
 */
export async function runNpmInstall(
  wc: WebContainer,
  onLog: LogCallback,
): Promise<number> {
  const proc = await wc.spawn("npm", ["install"]);

  proc.output.pipeTo(
    new WritableStream({
      write(chunk) {
        const clean = stripAnsi(chunk);
        if (clean) onLog(clean);
      },
    }),
  );

  return proc.exit;
}

/**
 * Start the Vite dev server and return the embeddable URL from `server-ready`.
 * Pipes dev-server output to the callback.
 */
export function startDevServer(
  wc: WebContainer,
  onLog: LogCallback,
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Dev server timed out after 60s")),
      60_000,
    );

    // Listen for server-ready BEFORE spawning so we don't miss the event
    wc.on("server-ready", (_port: number, url: string) => {
      clearTimeout(timeout);
      resolve(url);
    });

    const proc = await wc.spawn("npm", ["run", "dev"]);

    proc.output.pipeTo(
      new WritableStream({
        write(chunk) {
          const clean = stripAnsi(chunk);
          if (clean) onLog(clean);
        },
      }),
    );

    // If the process exits before server-ready, something went wrong
    proc.exit.then((code) => {
      if (code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Dev server exited with code ${code}`));
      }
    });
  });
}