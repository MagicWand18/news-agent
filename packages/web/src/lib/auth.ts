import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@mediabot/shared";

declare module "next-auth" {
  interface User {
    role: string;
    orgId: string | null;
    isSuperAdmin: boolean;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      orgId: string | null;
      isSuperAdmin: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    orgId: string | null;
    userId: string;
    isSuperAdmin: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email!,
          role: user.role,
          orgId: user.orgId,
          isSuperAdmin: user.isSuperAdmin,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.orgId = user.orgId;
        token.userId = user.id;
        token.isSuperAdmin = user.isSuperAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.orgId = token.orgId;
        session.user.id = token.userId;
        session.user.isSuperAdmin = token.isSuperAdmin;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
