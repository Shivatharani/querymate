import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/lib";
import { user, TOKEN_LIMITS } from "@/lib/schema";
import { eq } from "drizzle-orm";
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

    // Check if we need to reset (new day)
    const now = new Date();
    const resetAt = new Date(userData.tokenResetAt);
    const needsReset =
      now.getDate() !== resetAt.getDate() ||
      now.getMonth() !== resetAt.getMonth() ||
      now.getFullYear() !== resetAt.getFullYear();

    const tokensUsed = needsReset ? 0 : userData.tokensUsedToday;
    const tokensRemaining = limit - tokensUsed;

    // Calculate next reset time (midnight)
    const nextReset = new Date(now);
    nextReset.setDate(nextReset.getDate() + 1);
    nextReset.setHours(0, 0, 0, 0);

    return NextResponse.json({
      usage: {
        tokensUsed,
        tokensLimit: limit,
        tokensRemaining,
        tokensPercentage: Math.round((tokensUsed / limit) * 100),
        subscriptionTier: userData.subscriptionTier,
      },
      resetsAt: nextReset.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching usage:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}