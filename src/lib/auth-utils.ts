import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export interface AuthenticatedUser {
  userId: string;
}

/**
 * Authenticates a Request by checking:
 * 1. The browser session via next-auth
 * 2. The Authorization header for a Bearer API Key
 * 
 * Returns the authenticated user object or null if unauthorized.
 */
export async function authenticateRequest(req: Request): Promise<AuthenticatedUser | null> {
  // 1. Try Session Authentication (for Web UI calls)
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    return { userId: session.user.id };
  }

  // 2. Try Bearer API Key Authentication (for programmatic/external calls)
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const plainKey = authHeader.substring(7).trim();
    if (plainKey) {
      const keyPrefix = plainKey.slice(0, 12);
      const apiKeys = await db.apiKey.findMany({ where: { keyPrefix } });

      for (const apiKey of apiKeys) {
        const isMatch = await bcrypt.compare(plainKey, apiKey.hashedKey);
        if (isMatch) {
          // Update lastUsedAt asynchronously (best effort, do not block)
          db.apiKey.update({
            where: { id: apiKey.id },
            data: { lastUsedAt: new Date() }
          }).catch((err) => console.error("Failed to update API key lastUsedAt:", err));

          return { userId: apiKey.userId };
        }
      }
    }
  }

  return null;
}
