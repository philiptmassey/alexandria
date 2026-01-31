"use client";

import { useSession } from "next-auth/react";
import AuthSplash from "@/app/components/auth-splash";
import DocsScreen from "@/app/components/docs-screen";

export default function Home() {
  const { status } = useSession();

  if (status !== "authenticated") {
    return <AuthSplash />;
  }

  return <DocsScreen />;
}
