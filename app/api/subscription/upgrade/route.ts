import { db } from "@/lib/lib";
import { user, TOKEN_LIMITS } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-middleware";

type SubscriptionTier = keyof typeof TOKEN_LIMITS;

const VALID_TIERS: SubscriptionTier[] = ["free", "pro", "pro-max"];

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { tier } = body as { tier: string };

    // Validate tier
    if (!tier || !VALID_TIERS.includes(tier as SubscriptionTier)) {
      return NextResponse.json(
        { error: "Invalid subscription tier" },
        { status: 400 }
      );
    }

    const newTier = tier as SubscriptionTier;
    const tokenLimits = TOKEN_LIMITS[newTier];

    // Update user subscription
    const [updatedUser] = await db
      .update(user)
      .set({
        subscriptionTier: newTier,
        maxOutputTokens: tokenLimits.maxOutputTokens,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id))
      .returning();

    if (!updatedUser) {
      return NextResponse.json(
        { error: "Failed to update subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription: {
        tier: newTier,
        dailyTokens: tokenLimits.dailyTokens,
        maxOutputTokens: tokenLimits.maxOutputTokens,
      },
      message: `Successfully upgraded to ${newTier === "pro-max" ? "Pro Max" : newTier.charAt(0).toUpperCase() + newTier.slice(1)}!`,
    });
  } catch (error) {
    console.error("Subscription upgrade error:", error);
    return NextResponse.json(
      { error: "Failed to upgrade subscription" },
      { status: 500 }
    );
  }
}

// GET current subscription status
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [userData] = await db
      .select({
        subscriptionTier: user.subscriptionTier,
        maxOutputTokens: user.maxOutputTokens,
        tokensUsedToday: user.tokensUsedToday,
      })
      .from(user)
      .where(eq(user.id, session.user.id));

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const tier = (userData.subscriptionTier || "free") as SubscriptionTier;
    const tokenLimits = TOKEN_LIMITS[tier] || TOKEN_LIMITS.free;

    return NextResponse.json({
      subscription: {
        tier,
        dailyTokens: tokenLimits.dailyTokens,
        maxOutputTokens: tokenLimits.maxOutputTokens,
        tokensUsedToday: userData.tokensUsedToday,
        tokensRemaining: tokenLimits.dailyTokens - (userData.tokensUsedToday || 0),
      },
    });
  } catch (error) {
    console.error("Get subscription error:", error);
    return NextResponse.json(
      { error: "Failed to get subscription" },
      { status: 500 }
    );
  }
}