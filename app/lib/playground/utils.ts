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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${artifact.title || "Preview"}</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
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
  <script src="https://cdn.tailwindcss.com"></script>
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