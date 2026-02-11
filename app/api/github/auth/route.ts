import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  // STEP 1: Redirect user to GitHub OAuth (Publish App)
  if (!code) {
    const githubAuthURL =
      "https://github.com/login/oauth/authorize" +
      `?client_id=${process.env.GITHUB_PUBLISH_CLIENT_ID}` +
      `&redirect_uri=${process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI}` +
      `&scope=repo`;

    return NextResponse.redirect(githubAuthURL);
  }

  // STEP 2: Exchange code for access token (SAME Publish App)
  const tokenRes = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: process.env.GITHUB_PUBLISH_CLIENT_ID!,
        client_secret: process.env.GITHUB_PUBLISH_CLIENT_SECRET!,
        code,
      }),
    }
  );

  const data = await tokenRes.json();

  if (!data.access_token) {
    console.error("GitHub OAuth failed:", data);
    return NextResponse.redirect(
      new URL("/chat?github=error", req.url)
    );
  }

  // TODO: store token securely (DB / session)
  // await saveGithubToken(userId, data.access_token);

  // ✅ Store token in secure HTTP-only cookie
const cookieStore = await cookies();

cookieStore.set("github_token", data.access_token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24,
});


return NextResponse.redirect(
  new URL("/chat?github=connected", req.url)
);
}