// Preview HTML generation utilities for Canvas

import { Artifact } from "./types";

/**
 * Generates a standalone HTML document that can render React/JSX code
 * Uses Babel standalone for in-browser JSX transformation
 */
export function generatePreviewHtml(artifact: Artifact): string {
  // Find the main component file
  const mainFile = artifact.files.find((f) =>
    f.path.match(/\.(jsx|tsx|js|ts)$/)
  );

  if (!mainFile) {
    return generateErrorHtml("No JavaScript/TypeScript file found");
  }

  let code = mainFile.content;

  // Transform code for browser execution
  // Remove export statements
  code = code.replace(/export default function (\w+)/g, "function $1");
  code = code.replace(/export function (\w+)/g, "function $1");
  code = code.replace(/export const (\w+)/g, "const $1");
  code = code.replace(/export default (\w+);?/g, "");

  // Remove import statements (React is provided globally)
  code = code.replace(/import .* from ['"]react['"];?\n?/g, "");
  code = code.replace(/import .* from ['"]react-dom['"];?\n?/g, "");
  code = code.replace(/import .* from ['"]next\/.*['"];?\n?/g, "");
  
  // Remove TypeScript type annotations for simpler execution
  code = code.replace(/: React\.FC(<.*>)?/g, "");
  code = code.replace(/: React\.ReactNode/g, "");
  code = code.replace(/interface \w+ \{[^}]*\}/g, "");
  code = code.replace(/type \w+ = [^;]+;/g, "");

  // Find CSS file in artifact if exists
  const cssFile = artifact.files.find((f) => f.path.match(/\.css$/));
  const customCss = cssFile?.content || "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${artifact.title || "Preview"}</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script type="module">
    import { install } from 'https://esm.sh/@twind/core@1';
    import presetTailwind from 'https://esm.sh/@twind/preset-tailwind@1';
    install({ presets: [presetTailwind()] });
  </script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    ${customCss}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    // Provide React hooks globally
    const { useState, useEffect, useCallback, useRef, useMemo, useReducer, useContext, createContext } = React;
    
    // Error boundary for catching render errors
    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
      }
      static getDerivedStateFromError(error) {
        return { hasError: true, error };
      }
      render() {
        if (this.state.hasError) {
          return React.createElement('div', {
            style: { padding: 20, color: '#dc2626', fontFamily: 'monospace' }
          }, 'Error: ' + this.state.error?.message);
        }
        return this.props.children;
      }
    }

    try {
      ${code}
      
      // Try to find and render the main component
      const ComponentToRender = 
        typeof App !== 'undefined' ? App :
        typeof Main !== 'undefined' ? Main :
        typeof Component !== 'undefined' ? Component :
        typeof Home !== 'undefined' ? Home :
        typeof Page !== 'undefined' ? Page :
        null;
      
      if (ComponentToRender) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(
          React.createElement(ErrorBoundary, null,
            React.createElement(ComponentToRender)
          )
        );
      } else {
        document.getElementById('root').innerHTML = '<div style="padding: 20px; color: #f59e0b;">No component found to render. Make sure your component is named App, Main, Component, Home, or Page.</div>';
      }
    } catch (error) {
      document.getElementById('root').innerHTML = '<div style="padding: 20px; color: #dc2626; font-family: monospace;">Error: ' + error.message + '</div>';
    }
  </script>
</body>
</html>`;
}

/**
 * Generates an error HTML page
 */
export function generateErrorHtml(message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      margin: 0; 
      padding: 20px; 
      font-family: system-ui; 
      background: #fef2f2;
      color: #dc2626;
    }
  </style>
</head>
<body>
  <h3>Preview Error</h3>
  <p>${message}</p>
</body>
</html>`;
}

/**
 * Generates HTML for plain HTML/CSS preview
 */
export function generateHtmlPreview(code: string, css?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script type="module">
    import { install } from 'https://esm.sh/@twind/core@1';
    import presetTailwind from 'https://esm.sh/@twind/preset-tailwind@1';
    install({ presets: [presetTailwind()] });
  </script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui; }
    ${css || ""}
  </style>
</head>
<body>
  ${code}
</body>
</html>`;
}

/**
 * Checks if a language is previewable in the canvas
 */
export function isPreviewableLanguage(language: string): boolean {
  const previewable = [
    "html",
    "css",
    "javascript",
    "js",
    "jsx",
    "tsx",
    "typescript",
    "react",
  ];
  return previewable.includes(language.toLowerCase());
}

/**
 * Checks if a language is executable via E2B
 */
export function isExecutableLanguage(language: string): boolean {
  const executable = ["python", "py", "javascript", "js"];
  return executable.includes(language.toLowerCase());
}

/**
 * Checks if a language can be used in Canvas (previewable OR executable)
 */
export function isCanvasLanguage(language: string): boolean {
  return isPreviewableLanguage(language) || isExecutableLanguage(language);
}

/**
 * Generates an HTML page telling the user to switch to npm mode.
 * Shown in Fast Preview when code uses external npm packages.
 */
export function generateNpmRequiredHtml(packages: string[]): string {
  const pkgList = packages.map((p) => `<li>${p}</li>`).join("\n          ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: #e2e8f0;
      padding: 24px;
    }
    .card {
      max-width: 420px;
      background: rgba(255,255,255,0.06);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 32px;
      text-align: center;
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h2 { font-size: 20px; font-weight: 600; margin-bottom: 8px; color: #fff; }
    p { font-size: 14px; color: #94a3b8; margin-bottom: 16px; line-height: 1.5; }
    .pkg-list {
      text-align: left;
      background: rgba(0,0,0,0.3);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-family: monospace;
      font-size: 13px;
      list-style: none;
    }
    .pkg-list li::before { content: "📦 "; }
    .pkg-list li { padding: 3px 0; color: #a78bfa; }
    .hint {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #7c3aed, #6d28d9);
      color: #fff;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚡→📦</div>
    <h2>npm Packages Required</h2>
    <p>This code uses external packages that aren't available in Fast mode:</p>
    <ul class="pkg-list">
      ${pkgList}
    </ul>
    <div class="hint">
      ↑ Switch to <strong>npm</strong> mode above to run this code
    </div>
  </div>
</body>
</html>`;
}