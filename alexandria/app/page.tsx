import { getServerSession } from "next-auth/next";
import AuthSplash from "@/app/components/auth-splash";
import Library from "@/app/components/library";
import { authOptions } from "@/lib/auth";
import { listDocs } from "@/lib/docs";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return <AuthSplash />;
  }

  const initialPage = await listDocs({ userId, status: "unread" });
  return (
    <Library
      initialPage={initialPage}
      userLabel={session?.user?.email ?? session?.user?.name ?? "Account"}
    />
  );
}
