"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageSquare, Zap, Globe, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-gray-50 dark:from-gray-950 dark:to-gray-900">
      <Navbar />

      {/* Hero Section */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-20">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-gray-100 dark:bg-gray-800 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 mb-4 sm:mb-6">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500" />
              <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                Powered by Advanced AI
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white tracking-tight mb-4 sm:mb-6">
              Your Intelligent
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                AI Chat Assistant
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8 sm:mb-10 px-4 sm:px-0">
              Experience seamless conversations with multiple AI models. Get
              instant answers, creative ideas, and intelligent assistance — all
              in one place.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12 sm:mb-16 px-4 sm:px-0">
              <Link href="/auth/signup" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto font-semibold bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 text-white px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg rounded-xl"
                >
                  Get Started Free
                </Button>
              </Link>
              <Link href="/auth/login" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto font-semibold px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg rounded-xl border-2 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Sign In
                </Button>
              </Link>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-4xl mx-auto px-2 sm:px-0">
              <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 mx-auto">
                  <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-base sm:text-lg mb-1.5 sm:mb-2 text-gray-900 dark:text-white">
                  Natural Conversations
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
                  Chat naturally with AI that understands context and delivers
                  meaningful responses.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 mx-auto">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold text-base sm:text-lg mb-1.5 sm:mb-2 text-gray-900 dark:text-white">
                  Lightning Fast
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
                  Get instant responses powered by cutting-edge AI models for
                  maximum efficiency.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 dark:bg-green-900/30 rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 mx-auto">
                  <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-base sm:text-lg mb-1.5 sm:mb-2 text-gray-900 dark:text-white">
                  Multiple AI Models
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
                  Choose from Google Gemini, Perplexity, and more AI models to
                  suit your needs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
