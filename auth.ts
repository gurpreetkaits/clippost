import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        // Dynamically import prisma to avoid Edge Runtime issues in middleware
        const { prisma } = await import("@/lib/db");
        const user = await prisma.user.upsert({
          where: { googleId: account.providerAccountId },
          update: {
            email: profile?.email,
            name: profile?.name,
            image: profile?.picture as string | undefined,
          },
          create: {
            googleId: account.providerAccountId,
            email: profile?.email,
            name: profile?.name,
            image: profile?.picture as string | undefined,
          },
        });
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
