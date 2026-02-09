// Artifact types for Canvas preview

export interface ArtifactFile {
  path: string;
  content: string;
  language: string;
}

export interface Artifact {
  id: string;
  title: string;
  files: ArtifactFile[];
  language: string;
  createdAt: Date;
}

export interface ConsoleLog {
  type: "log" | "error" | "warn" | "info";
  message: string;
  timestamp: Date;
}

export interface ExecutionResult {
  output: string;
  error?: string;
  logs: ConsoleLog[];
  images?: string[]; // Base64 encoded images from matplotlib, etc.
}