import { NextRequest, NextResponse } from "next/server";
import { getGithubToken } from "../../../lib/github";


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const path = searchParams.get("path") || "";

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
        Accept: "application/vnd.github+json",
      },
    }
  );

  const data = await res.json();
  return NextResponse.json(data);
}