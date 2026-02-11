import { NextResponse } from "next/server";
import { getGithubToken } from "../../../lib/github";


export async function GET() {
 const token = await getGithubToken();


if (!token) {
  return NextResponse.json(
    { error: "Not authenticated" },
    { status: 401 }
  );
}


  const res = await fetch("https://api.github.com/user/repos", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  const data = await res.json();
  return NextResponse.json(data);
}