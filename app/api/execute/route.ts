import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-middleware";

// Dynamic import to avoid bundling issues
async function createSandbox() {
  const { Sandbox } = await import("@e2b/code-interpreter");
  return Sandbox;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code, language } = await req.json();

    if (!code || !language) {
      return NextResponse.json(
        { error: "Code and language are required" },
        { status: 400 }
      );
    }

    // Check if E2B API key is configured
    const apiKey = process.env.E2B_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        output: "",
        error: "E2B API key not configured. Please add E2B_API_KEY to your .env file.",
        logs: [],
      });
    }

    // Only support Python and JavaScript for now
    const supportedLanguages = ["python", "py", "javascript", "js"];
    if (!supportedLanguages.includes(language.toLowerCase())) {
      return NextResponse.json({
        output: "",
        error: `Language "${language}" is not supported for execution. Supported: Python, JavaScript`,
        logs: [],
      });
    }

    console.log("🚀 E2B: Creating sandbox for", language);

    // Create E2B sandbox
    const SandboxClass = await createSandbox();
    const sandbox = await SandboxClass.create({ apiKey });

    try {
      console.log("🚀 E2B: Executing code...");
      
      let result;
      if (language.toLowerCase() === "python" || language.toLowerCase() === "py") {
        result = await sandbox.runCode(code);
      } else {
        result = await sandbox.runCode(code, { language: "javascript" });
      }

      console.log("🚀 E2B: Execution complete", { 
        stdout: result.logs?.stdout?.length || 0,
        stderr: result.logs?.stderr?.length || 0,
        results: result.results?.length || 0
      });

      // Extract output, errors, and images
      const stdout = result.logs?.stdout || [];
      const stderr = result.logs?.stderr || [];
      
      const output = stdout.join("\n");
      // ExecutionError has: name, value, traceback (not message)
      const error = stderr.length > 0 
        ? stderr.join("\n") 
        : result.error 
          ? `${result.error.name}: ${result.error.value}\n${result.error.traceback}` 
          : "";
      
      // Extract base64 images from results (e.g., matplotlib plots)
      const images: string[] = [];
      if (result.results) {
        for (const r of result.results) {
          if (r.png) {
            images.push(r.png);
          }
        }
      }

      const logs = stdout.map((msg: string) => ({
        type: "log" as const,
        message: msg,
        timestamp: new Date(),
      }));

      return NextResponse.json({
        output,
        error: error || undefined,
        logs,
        images: images.length > 0 ? images : undefined,
      });
    } finally {
      // Always close the sandbox
      await sandbox.kill();
      console.log("🚀 E2B: Sandbox killed");
    }
  } catch (error) {
    console.error("❌ E2B execution error:", error);
    return NextResponse.json({
      output: "",
      error: error instanceof Error ? error.message : "Execution failed",
      logs: [],
    });
  }
}