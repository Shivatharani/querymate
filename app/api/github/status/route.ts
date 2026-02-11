import { NextResponse } from "next/server";
import { getGithubToken } from "../../../lib/github";


export async function GET() {
  const token = await getGithubToken();


if (!token) {
  return NextResponse.json({ connected: false });
}


  if (!token) {
    return NextResponse.json({ connected: false });
  }

  // Optionally fetch user
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const user = await userRes.json();

  // Fetch saved repo from DB if exists
  const savedRepo = null; // replace with DB lookup

  return NextResponse.json({
    connected: true,
    username: user.login,
    repo: savedRepo,
  });
}