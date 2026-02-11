"use client";

import { createContext, useContext } from "react";

export interface CanvasContextType {
  isCanvasOpen: boolean;
  showPreview: (code: string, language: string) => void;
}

const CanvasContext = createContext<CanvasContextType | null>(null);

export function useCanvas() {
  return useContext(CanvasContext);
}

export function CanvasProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: CanvasContextType;
}) {
  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  );
}

export default CanvasContext;