import { NextRequest, NextResponse } from "next/server";
import { getGithubToken } from "../../../lib/github";

export async function POST(req: NextRequest) {
    const token = await getGithubToken();

    if (!token) {
        return NextResponse.json(
            { error: "Not authenticated with GitHub" },
            { status: 401 }
        );
    }

    const { conversationId, files, suggestedName } = await req.json();

    if (!conversationId) {
        return NextResponse.json(
            { error: "Conversation ID required for syncing" },
            { status: 400 }
        );
    }

    try {
        // 1. Get username
        const userRes = await fetch("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!userRes.ok) {
            return NextResponse.json({ error: "Failed to get user details" }, { status: userRes.status });
        }

        const user = await userRes.json();
        const owner = user.login;

        // 2. Determine repo name based on conversation ID
        // GitHub repo names must be < 100 chars and match [A-Za-z0-9_.-]+
        const safeConvId = conversationId.replace(/[^a-zA-Z0-9-]/g, "").substring(0, 12);
        const repoName = `querymate-${safeConvId}`;

        // 3. Check if repo exists
        const repoCheck = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        let repoUrl = "";
        let isNew = false;

        if (repoCheck.ok) {
            // Repo exists
            const repo = await repoCheck.json();
            repoUrl = repo.html_url;
        } else if (repoCheck.status === 404) {
            // Repo does not exist, create it
            const createRes = await fetch("https://api.github.com/user/repos", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
                body: JSON.stringify({
                    name: repoName,
                    private: false,
                    auto_init: true,
                    description: "Created by QueryMate Sandbox"
                })
            });

            if (!createRes.ok) {
                const errorData = await createRes.json();
                console.error("Failed to create repo:", errorData);
                return NextResponse.json({ error: "Failed to create repo" }, { status: createRes.status });
            }

            const repo = await createRes.json();
            repoUrl = repo.html_url;
            isNew = true;

            // Add README.md
            await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/README.md`, {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
                body: JSON.stringify({
                    message: "Initial commit from QueryMate",
                    content: Buffer.from(`# ${suggestedName || 'QueryMate Project'}\n\nRepository generated from a QueryMate Sandbox session.`).toString("base64"),
                }),
            });
        } else {
            return NextResponse.json({ error: "Error checking repo status" }, { status: repoCheck.status });
        }

        // 4. Commit files
        for (const file of files) {
            // Fix specific case where code block might incorrectly use txt instead of right extension
            let path = file.path || `index.${file.language || "txt"}`;

            const content = file.content;
            const message = `Update ${path} via QueryMate`;

            // Check if file exists to get its SHA (required for updating existing files)
            const existingRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${path}`, {
                headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
            });

            let sha = undefined;

            if (existingRes.ok) {
                const existingFile = await existingRes.json();
                sha = existingFile.sha;
            }

            await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${path}`, {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
                body: JSON.stringify({
                    message,
                    content: Buffer.from(content).toString("base64"),
                    ...(sha && { sha })
                })
            });
        }

        return NextResponse.json({
            success: true,
            repoUrl,
            isNew,
            owner,
            repoName
        });
    } catch (error) {
        console.error("Sync error:", error);
        return NextResponse.json(
            { error: "Sync failed" },
            { status: 500 }
        );
    }
}
