import { db } from "@/lib/lib";
import { user, TOKEN_LIMITS } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-middleware";

async function checkAndResetDailyTokens(userId: string) {
  const [userData] = await db.select().from(user).where(eq(user.id, userId));

  if (!userData) return null;

  const now = new Date();
  const resetAt = new Date(userData.tokenResetAt);

  // Check if it's a new day
  if (
    now.getDate() !== resetAt.getDate() ||
    now.getMonth() !== resetAt.getMonth() ||
    now.getFullYear() !== resetAt.getFullYear()
  ) {
    await db
      .update(user)
      .set({
        tokensUsedToday: 0,
        tokenResetAt: now,
        lastTokenAlert: null,
      })
      .where(eq(user.id, userId));

    return {
      ...userData,
      tokensUsedToday: 0,
      tokenResetAt: now,
      lastTokenAlert: null,
    };
  }

  return userData;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userData = await checkAndResetDailyTokens(session.user.id);

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const tier = userData.subscriptionTier as keyof typeof TOKEN_LIMITS;
    const limit = TOKEN_LIMITS[tier]?.dailyTokens || TOKEN_LIMITS.free.dailyTokens;
    const thresholds = TOKEN_LIMITS[tier]?.alertThresholds || TOKEN_LIMITS.free.alertThresholds;

    const tokensRemaining = limit - userData.tokensUsedToday;
    const tokensPercentage = (userData.tokensUsedToday / limit) * 100;

    // Determine if alert should be shown
    let shouldShowAlert = false;
    let alertLevel: "warning" | "critical" | "depleted" = "warning";

    if (tokensRemaining <= 0) {
      shouldShowAlert = true;
      alertLevel = "depleted";
    } else if (tokensRemaining <= thresholds[2]) {
      shouldShowAlert = true;
      alertLevel = "critical";
    } else if (tokensRemaining <= thresholds[0]) {
      shouldShowAlert = true;
      alertLevel = "warning";
    }

    // Calculate time until reset
    const resetAt = new Date(userData.tokenResetAt);
    const tomorrow = new Date(resetAt);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const hoursUntilReset = Math.ceil(
      (tomorrow.getTime() - Date.now()) / (1000 * 60 * 60)
    );

    return NextResponse.json({
      tokensUsed: userData.tokensUsedToday,
      tokensLimit: limit,
      tokensRemaining,
      tokensPercentage: Math.round(tokensPercentage),
      subscriptionTier: userData.subscriptionTier,
      shouldShowAlert,
      alertLevel,
      hoursUntilReset,
      resetAt: userData.tokenResetAt,
      lastTokenAlert: userData.lastTokenAlert,
    });
  } catch (error) {
    console.error("Error fetching token status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { updateLastAlert } = body;

    if (updateLastAlert !== undefined) {
      await db
        .update(user)
        .set({ lastTokenAlert: updateLastAlert })
        .where(eq(user.id, session.user.id));

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("Error updating token alert:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}