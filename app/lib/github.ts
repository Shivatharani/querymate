import { cookies } from "next/headers";

export async function getGithubToken() {
  const cookieStore = await cookies();
  return cookieStore.get("github_token")?.value;
}
