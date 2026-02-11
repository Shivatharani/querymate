"use client";

import { useEffect, useState } from "react";

export default function GitHubRepoPicker({ onSelect }: any) {
  const [repos, setRepos] = useState([]);

  useEffect(() => {
    fetch("/api/github/repos")
      .then(res => res.json())
      .then(setRepos);
  }, []);

  return (
    <div className="space-y-2">
      {repos.map((repo: any) => (
        <button
          key={repo.id}
          onClick={() => onSelect(repo)}
          className="w-full p-2 border rounded hover:bg-muted"
        >
          {repo.full_name}
        </button>
      ))}
    </div>
  );
}