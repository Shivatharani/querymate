import { NextRequest, NextResponse } from "next/server";
import { getGithubToken } from "../../../lib/github";


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const path = searchParams.get("path");

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
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const file = await res.json();
  const content = Buffer.from(file.content, "base64").toString("utf-8");

  return NextResponse.json({
    content,
    sha: file.sha,
  });
}