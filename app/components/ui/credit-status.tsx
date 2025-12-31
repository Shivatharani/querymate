"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { Progress } from "./progress";
import { Clock, RefreshCw } from "lucide-react";

interface CreditStatusProps {
  plan: string;
  creditsUsed: number;
  creditsDaily: number;
  creditsMonthly: number;
  creditsYearly: number;
  resetDaily: string;
  resetMonthly: string;
  isLoading?: boolean;
}

export function CreditStatus({
  plan,
  creditsUsed,
  creditsDaily,
  creditsMonthly,
  creditsYearly,
  resetDaily,
  resetMonthly,
  isLoading = false
}: CreditStatusProps) {
  const dailyUsed = Math.min(creditsUsed, creditsDaily);
  const dailyPercent = (dailyUsed / creditsDaily) * 100;
  const monthlyUsed = Math.min(creditsUsed, creditsMonthly);
  const monthlyPercent = (monthlyUsed / creditsMonthly) * 100;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{plan} Plan</CardTitle>
          <Badge variant={dailyPercent < 80 ? "default" : "destructive"}>
            {dailyPercent < 80 ? "Active" : "Limited"}
          </Badge>
        </div>
        <CardDescription>Usage across periods</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Daily */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Daily ({creditsDaily})</span>
              <span>{dailyUsed}/{creditsDaily}</span>
            </div>
            <Progress value={dailyPercent} className="h-2" />
          </div>

          {/* Monthly */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Monthly ({creditsMonthly})</span>
              <span>{monthlyUsed}/{creditsMonthly}</span>
            </div>
            <Progress value={monthlyPercent} className="h-2" />
          </div>

          {/* Reset Info */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              Next reset: {resetDaily}
            </div>
            <RefreshCw className="h-4 w-4 text-green-500 animate-spin-slow" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
