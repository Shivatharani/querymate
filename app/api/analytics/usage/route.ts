import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/lib";
import { user, session, conversations, TOKEN_LIMITS } from "@/lib/schema";
import { eq, count, min } from "drizzle-orm";
import { getAuthSession } from "@/lib/auth-middleware";

async function checkAndResetDailyTokens(userId: string) {
  const [userData] = await db.select().from(user).where(eq(user.id, userId));

  if (!userData) return null;

  const now = new Date();
  const resetAt = new Date(userData.tokenResetAt);

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
    const authSession = await getAuthSession(req);

    if (!authSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authSession.user.id;

    // Get user data with token usage (with reset check)
    const userData = await checkAndResetDailyTokens(userId);

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get first login from earliest session OR user creation date
    const [firstSessionData] = await db
      .select({ firstLogin: min(session.createdAt) })
      .from(session)
      .where(eq(session.userId, userId));

    let firstLoginDate = userData.createdAt;
    
    if (firstSessionData?.firstLogin) {
      const firstSessionDate = new Date(firstSessionData.firstLogin);
      const userCreatedDate = new Date(userData.createdAt);
      firstLoginDate = firstSessionDate < userCreatedDate 
        ? firstSessionDate 
        : userCreatedDate;
    }

    // Get total number of sessions (logins)
    const [sessionCountData] = await db
      .select({ count: count() })
      .from(session)
      .where(eq(session.userId, userId));

    const totalLogins = sessionCountData?.count || 0;

    // Get total conversations count
    const [conversationCountData] = await db
      .select({ count: count() })
      .from(conversations)
      .where(eq(conversations.userId, userId));

    const totalConversations = conversationCountData?.count || 0;

    // Get token limits based on subscription tier
    const tier = userData.subscriptionTier as keyof typeof TOKEN_LIMITS;
    const limit = TOKEN_LIMITS[tier]?.dailyTokens || TOKEN_LIMITS.free.dailyTokens;

    // Format the response
    const usage = {
      firstLogin: firstLoginDate ? new Date(firstLoginDate).toISOString() : null,
      totalLogins,
      totalConversations,
      tokens: {
        tokensUsed: userData.tokensUsedToday,
        tokensLimit: limit,
        tokensRemaining: limit - userData.tokensUsedToday,
        tokensPercentage: Math.round((userData.tokensUsedToday / limit) * 100),
        subscriptionTier: userData.subscriptionTier,
      },
    };

    return NextResponse.json({ usage });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}