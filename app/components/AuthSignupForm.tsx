"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/better-auth-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  EyeOpenIcon,
  EyeClosedIcon,
  GitHubLogoIcon,
} from "@radix-ui/react-icons";
import { FcGoogle } from "react-icons/fc";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthSignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const getErrorText = (e: unknown): string => {
    if (typeof e === "string") return e;
    if (e && typeof e === "object" && "message" in e) {
      const msg = (e as { message?: unknown }).message;
      return typeof msg === "string" ? msg : JSON.stringify(e);
    }
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const response = await signUp.email({ name, email, password });
      if (response?.error) {
        setError(getErrorText(response.error));
      } else if (response?.data) {
        router.push("/chat");
      } else {
        setError("Unknown error during signup. See console.");
      }
    } catch {
      setError("Signup failed. Please try again.");
    }
    setLoading(false);
  }

  return (
    <form className="w-full" onSubmit={handleSubmit}>
      <h2 className="text-3xl font-bold mb-2 text-center text-gray-900 dark:text-white">
        Create an account
      </h2>
      <p className="mb-6 text-center text-gray-500 dark:text-gray-400">
        Sign up to start using QueryMate AI
      </p>
      <div className="mb-3">
        <label className="block font-medium mb-1 dark:text-gray-200">
          Name:{" "}
          <span className="font-normal text-xs text-gray-400 dark:text-gray-500 ml-1">
            eg. Shiva M
          </span>
        </label>
        <Input
          required
          type="text"
          autoComplete="name"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          suppressHydrationWarning
          className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        />
      </div>
      <div className="mb-3">
        <label className="block font-medium mb-1 dark:text-gray-200">
          Email:{" "}
          <span className="font-normal text-xs text-gray-400 dark:text-gray-500 ml-1">
            eg. email@example.com
          </span>
        </label>
        <Input
          required
          type="email"
          autoComplete="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          suppressHydrationWarning
          className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        />
      </div>
      <div className="mb-3 relative">
        <label className="block font-medium mb-1 dark:text-gray-200">
          Password:{" "}
          <span className="font-normal text-xs text-gray-400 dark:text-gray-500 ml-1">
            eg. ••••••
          </span>
        </label>
        <Input
          required
          type={showPass ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          suppressHydrationWarning
          className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        />
        <button
          type="button"
          className="absolute top-8 right-3 text-gray-400 dark:text-gray-500 focus:outline-none"
          onClick={() => setShowPass((s) => !s)}
          tabIndex={-1}
        >
          {showPass ? <EyeOpenIcon /> : <EyeClosedIcon />}
        </button>
      </div>
      <div className="mb-4 relative">
        <label className="block font-medium mb-1 dark:text-gray-200">
          Confirm Password:{" "}
          <span className="font-normal text-xs text-gray-400 dark:text-gray-500 ml-1">
            6+ letters/numbers
          </span>
        </label>
        <Input
          required
          type={showConfirm ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          suppressHydrationWarning
          className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        />
        <button
          type="button"
          className="absolute top-8 right-3 text-gray-400 dark:text-gray-500 focus:outline-none"
          onClick={() => setShowConfirm((s) => !s)}
          tabIndex={-1}
        >
          {showConfirm ? <EyeOpenIcon /> : <EyeClosedIcon />}
        </button>
      </div>
      {error && (
        <div className="text-red-500 dark:text-red-400 mb-2">{error}</div>
      )}
      <Button
        type="submit"
        className="w-full bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 text-white py-2 mb-4 font-bold shadow hover:shadow-lg transition"
        disabled={loading}
      >
        {loading ? "Signing up..." : "Sign up"}
      </Button>
      <div className="my-4 text-center text-gray-400 dark:text-gray-500 font-medium text-xs">
        OR CONTINUE WITH
      </div>
      <div className="flex gap-4 mb-4">
        <Button
          type="button"
          variant="outline"
          className="w-1/2 flex items-center gap-2 justify-center border-gray-300 dark:border-gray-600 hover:border-black dark:hover:border-gray-400 shadow dark:text-gray-200 dark:hover:bg-gray-700"
          onClick={() => signUp.github()}
        >
          <GitHubLogoIcon /> Github
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-1/2 flex items-center gap-2 justify-center border-gray-300 dark:border-gray-600 hover:border-black dark:hover:border-gray-400 shadow dark:text-gray-200 dark:hover:bg-gray-700"
          onClick={() => signUp.google()}
        >
          <FcGoogle className="w-5 h-5" /> Google
        </Button>
      </div>
      <div className="text-center mt-2 text-sm dark:text-gray-300">
        Already have an account?{" "}
        <a
          href="/auth/login"
          className="text-gray-900 dark:text-white font-semibold underline hover:text-gray-700 dark:hover:text-gray-300"
        >
          Sign in
        </a>
      </div>
    </form>
  );
}
