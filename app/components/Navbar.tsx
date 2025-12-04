"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between sm:h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/QueryMate_Logo.png"
              alt="QueryMate Logo"
              width={36}
              height={36}
              className="h-7 w-7 rounded-lg sm:h-9 sm:w-9"
            />
            <span className="text-lg font-bold text-gray-900 dark:text-white sm:text-xl">
              QueryMate
            </span>
          </Link>

          {/* Desktop Auth Buttons */}
          <div className="hidden items-center gap-2 sm:flex sm:gap-3">
            <Link href="/">
              <Button
                variant="ghost"
                className="text-sm font-medium dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white sm:text-base"
              >
                Home
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button
                variant="ghost"
                className="text-sm font-medium dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white sm:text-base"
              >
                Sign In
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button className="text-sm font-medium bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 sm:text-base">
                Sign Up
              </Button>
            </Link>
            <ThemeToggle />
          </div>

          {/* Mobile Menu Button + Theme */}
          <div className="flex items-center gap-2 sm:hidden">
            <ThemeToggle />
            <button
              className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              ) : (
                <Menu className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="space-y-2 border-t border-gray-200 py-4 dark:border-gray-800 sm:hidden">
            <Link
              href="/"
              className="block rounded-lg px-4 py-2 font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/auth/login"
              className="block rounded-lg px-4 py-2 font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="mx-4 block rounded-lg bg-black py-2 text-center font-medium text-white dark:bg-white dark:text-black"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
