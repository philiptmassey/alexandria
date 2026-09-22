import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";

const authorizedEmails = new Set(
  (process.env.AUTHORIZED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      if (authorizedEmails.size === 0) {
        return true;
      }
      const email = user.email?.trim().toLowerCase();
      return Boolean(email && authorizedEmails.has(email));
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
};
