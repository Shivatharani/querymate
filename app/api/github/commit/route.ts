import { NextRequest, NextResponse } from "next/server";
import { getGithubToken } from "../../../lib/github";

export async function POST(req: NextRequest) {
  const { owner, repo, path, content, message } = await req.json();
  const token = await getGithubToken();

  if (!token) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  try {
    // 1️⃣ Check if file already exists
    const existingRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    let sha: string | undefined = undefined;

    if (existingRes.ok) {
      const existingFile = await existingRes.json();
      sha = existingFile.sha; // needed for update
    }

    // 2️⃣ Create or update file
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          message,
          content: Buffer.from(content).toString("base64"),
          ...(sha && { sha }), // only include sha if exists
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("GitHub commit failed:", data);
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json({
      success: true,
      path,
    });
  } catch (error) {
    console.error("Commit error:", error);
    return NextResponse.json(
      { error: "Commit failed" },
      { status: 500 }
    );
  }
}
