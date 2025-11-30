"use client";
import AuthSignupForm from "@/components/AuthSignupForm";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-gray-50 dark:from-gray-950 dark:to-gray-900">
      <Navbar />
      <div className="flex flex-1 items-center justify-center px-4 sm:px-6 py-12">
        <Card className="w-full max-w-md shadow-2xl border-none dark:bg-gray-800">
          <CardContent>
            <AuthSignupForm />
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
