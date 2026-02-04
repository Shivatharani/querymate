"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";

const pricingPlans = [
  {
    name: "Free",
    slug: "free",
    priceMonthly: 0,
    priceYearly: 0,
    tokensDaily: 5000,
    maxOutputTokens: 150,
    popular: false,
    features: [
      "5k tokens per day",
      "Access to Gemini 2.5 Flash",
      "Basic AI models",
      "Standard response speed",
      "Community support",
      "Perfect for trying out"
    ]
  },
  {
    name: "Pro",
    slug: "pro",
    priceMonthly: 9,
    priceYearly: 90,
    tokensDaily: 75000,
    maxOutputTokens: 500,
    popular: true,
    features: [
      "75k tokens per day",
      "Access to all Gemini models",
      "Priority AI processing",
      "Faster responses",
      "Email support",
      "Analytics dashboard",
      "Extended conversation history"
    ]
  },
  {
    name: "Pro Max",
    slug: "pro-max",
    priceMonthly: 29,
    priceYearly: 290,
    tokensDaily: 250000,
    maxOutputTokens: 800,
    popular: false,
    features: [
      "250k tokens per day",
      "Unlimited model access",
      "All premium AI models",
      "Lightning fast responses",
      "Priority support",
      "API access",
      "Custom models",
      "Dedicated account manager",
      "Advanced analytics"
    ]
  }
];

export default function PricingPage() {
  const router = useRouter();
  const [isYearly, setIsYearly] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<{ open: boolean; plan: string; tokens: number } | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/sessions", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setIsAuthenticated(!!data?.user);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  const getButtonText = (plan: typeof pricingPlans[0]) => {
    if (plan.slug === "free") return "Get Started Free";
    if (plan.slug === "pro") return "Upgrade to Pro";
    return "Upgrade to Pro Max";
  };

  const handleFreeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isAuthenticated) {
      router.push("/chat");
    } else {
      router.push("/auth/signup");
    }
  };

  const handleUpgrade = async (plan: typeof pricingPlans[0]) => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    setUpgrading(plan.slug);

    try {
      const response = await fetch("/api/subscription/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tier: plan.slug }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upgrade");
      }

      setSuccessModal({
        open: true,
        plan: plan.name,
        tokens: plan.tokensDaily,
      });

      setTimeout(() => {
        router.push("/chat");
      }, 2000);
    } catch (error) {
      console.error("Upgrade error:", error);
      alert(error instanceof Error ? error.message : "Failed to upgrade. Please try again.");
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      {/* Success Modal */}
      <Dialog open={successModal?.open || false} onOpenChange={() => setSuccessModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-2xl font-bold text-center">
              Upgraded to {successModal?.plan}!
            </DialogTitle>
            <DialogDescription className="text-center text-lg">
              <div className="flex items-center justify-center gap-2 mt-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                <span>You now have {successModal?.tokens?.toLocaleString()} tokens per day!</span>
              </div>
              <p className="mt-4 text-sm text-gray-500">Redirecting to chat...</p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Back Button */}
      <button 
        onClick={() => router.push(isAuthenticated ? "/chat" : "/")}
        className="fixed top-6 left-6 z-50 p-3 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:bg-gray-800/80 dark:border-gray-700 dark:hover:bg-gray-700"
      >
        <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
      </button>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-24">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            QueryMate AI Pricing
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Choose the perfect plan based on your daily token needs. Tokens reset automatically every day.
          </p>
          
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-20">
          <div className="flex items-center p-1 rounded-2xl bg-white/60 backdrop-blur-sm shadow-xl border border-gray-200 dark:bg-gray-800/60 dark:border-gray-700">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                !isYearly
                  ? "bg-white text-gray-900 shadow-lg border border-gray-200 dark:bg-white dark:text-gray-900"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                isYearly
                  ? "bg-blue-500 text-white shadow-lg border border-blue-500"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Yearly <span className="ml-1 text-xs bg-white/20 px-2 py-1 rounded-full font-medium">Save 17%</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {pricingPlans.map((plan) => (
            <Card 
              key={plan.slug} 
              className={`relative overflow-hidden group hover:shadow-2xl transition-all duration-500 border-2 hover:border-gray-300 dark:hover:border-gray-600 ${
                plan.popular 
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 shadow-2xl shadow-blue-500/20 ring-2 ring-blue-100/50 dark:ring-blue-900/50" 
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute top-4 right-4 z-10">
                  <Badge className="bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm px-4 py-2 shadow-lg">
                    Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="pb-6 pt-16 lg:pt-20">
                <div className="flex flex-col items-center space-y-3">
                  <CardTitle className={`text-2xl lg:text-3xl font-bold text-center ${
                    plan.popular ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white"
                  }`}>
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="text-lg text-gray-600 dark:text-gray-400">
                    {plan.tokensDaily.toLocaleString()} tokens/day
                  </CardDescription>
                  
                  {/* Price */}
                  <div className="text-center space-y-2">
                    <div className={`text-4xl lg:text-5xl font-black ${
                      plan.popular 
                        ? "text-blue-500 dark:text-blue-400" 
                        : "text-gray-900 dark:text-white"
                    }`}>
                      ${isYearly ? plan.priceYearly : plan.priceMonthly}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {isYearly ? "per user / year" : "per user / month"}
                      {isYearly && <span className="ml-2 text-blue-600 font-semibold">Save 17%</span>}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pb-8">
                {/* Features */}
                <div className="space-y-4 mb-10">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start space-x-3 group-hover:translate-x-2 transition-transform duration-300">
                      <div className="flex-shrink-0 w-6 h-6 mt-0.5 bg-green-500 rounded-lg flex items-center justify-center shadow-md">
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feature}</span>
                    </div>
                  ))}
                </div>
                
                {/* CTA Button */}
                <Button 
                  onClick={plan.slug === "free" ? handleFreeClick : () => handleUpgrade(plan)}
                  disabled={upgrading === plan.slug}
                  className={`w-full h-14 text-lg font-bold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-0.5 ${
                    plan.popular 
                      ? "bg-blue-500 hover:bg-blue-600 text-white border-blue-500" 
                      : "bg-gray-900 hover:bg-black text-white dark:bg-gray-900 dark:hover:bg-black"
                  }`}
                  size="lg"
                  variant={plan.slug === "free" ? "outline" : "default"}
                >
                  {upgrading === plan.slug ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Upgrading...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      {getButtonText(plan)}
                      {plan.slug !== "free" && (
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      )}
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}