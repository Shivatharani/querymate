"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    router.push("/auth/login"); // Always go to login first
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-screen">
      <span className="font-medium text-lg">Redirecting to login...</span>
    </div>
  );
}
