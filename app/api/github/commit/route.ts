import { NextRequest, NextResponse } from "next/server";
import { getGithubToken } from "../../../lib/github";


export async function POST(req: NextRequest) {
  const { owner, repo, path, content, sha, message } = await req.json();
  const token = await getGithubToken();

if (!token) {
  return NextResponse.json(
    { error: "Not authenticated" },
    { status: 401 }
  );
}


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
        sha,
      }),
    }
  );

  const data = await res.json();
  return NextResponse.json(data);
}