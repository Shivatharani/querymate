"use client";

import { useEffect, useState } from "react";

export default function GitHubFilePicker({ owner, repo, onSelect }: any) {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    fetch(`/api/github/files?owner=${owner}&repo=${repo}`)
      .then(res => res.json())
      .then(setFiles);
  }, [owner, repo]);

  return (
    <div className="space-y-1">
      {files.map((file: any) => (
        <button
          key={file.path}
          onClick={() => onSelect(file)}
          className="block w-full text-left px-2 py-1 hover:bg-muted"
        >
          {file.name}
        </button>
      ))}
    </div>
  );
}