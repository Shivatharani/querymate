"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="w-full border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/QueryMate_Logo.png"
              alt="QueryMate Logo"
              width={36}
              height={36}
              className="rounded-lg w-7 h-7 sm:w-9 sm:h-9"
            />
            <span className="font-bold text-lg sm:text-xl text-gray-900 dark:text-white">
              QueryMate
            </span>
          </Link>

          {/* Desktop Auth Buttons */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-3">
            <Link href="/">
              <Button
                variant="ghost"
                className="font-medium text-sm sm:text-base dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800"
              >
                Home
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button
                variant="ghost"
                className="font-medium text-sm sm:text-base dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800"
              >
                Sign In
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button className="font-medium bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 text-white text-sm sm:text-base">
                Sign Up
              </Button>
            </Link>
            <ThemeToggle />
          </div>

          {/* Mobile Menu Button */}
          <div className="sm:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              ) : (
                <Menu className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-200 dark:border-gray-800 py-4 space-y-2">
            <Link
              href="/"
              className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/auth/login"
              className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="block mx-4 text-center py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium"
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
