/**
 * SentinelPrompt — NextAuth.js v4 configuration.
 *
 * Credentials provider backed by Prisma. Passwords are bcrypt-hashed.
 * JWT session strategy (works with SQLite, no session table needed).
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { UserRole } from "@/lib/enums";

export interface AppSessionUser {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as UserRole,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as AppSessionUser).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as AppSessionUser).id = token.id as string;
        (session.user as AppSessionUser).role = token.role as UserRole;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
