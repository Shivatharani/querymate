import { NextRequest, NextResponse } from "next/server";
import { getGithubToken } from "../../../lib/github";


export async function POST(req: NextRequest) {
  const token = await getGithubToken();

  const { suggestedName } = await req.json();


if (!token) {
  return NextResponse.json(
    { error: "Not authenticated with GitHub" },
    { status: 401 }
  );
}


  // ✅ Create a unique repo name
function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
}

const baseName = suggestedName
  ? slugify(suggestedName)
  : "querymate-project";

const repoName = `${baseName}`;


const res = await fetch("https://api.github.com/user/repos", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  },
  body: JSON.stringify({
    name: repoName,
    private: false,
    auto_init: true,
  }),
});


  const repo = await res.json();
  // ✅ Add README.md to repo
await fetch(
  `https://api.github.com/repos/${repo.owner.login}/${repo.name}/contents/README.md`,
  {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({
      message: "Initial commit from QueryMate",
      content: Buffer.from("# QueryMate Project\n\nRepo created from QueryMate sandbox.").toString("base64"),
    }),
  }
);

  // Save repo info in DB
  // { owner: repo.owner.login, name: repo.name }

  if (!res.ok) {
  return NextResponse.json(repo, { status: res.status });
}

return NextResponse.json({
  created: true,
  repoName: repo.name,
  owner: repo.owner.login,
  url: repo.html_url,
});



}