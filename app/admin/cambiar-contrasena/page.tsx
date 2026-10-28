import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminSessionFromCookie } from "@/lib/admin-auth";
import PasswordForm from "../PasswordForm";
export const dynamic = "force-dynamic";
export default async function Page() {
  const session = await adminSessionFromCookie((await headers()).get("cookie"));
  if (!session) redirect("/admin");
  return <PasswordForm mode="change" currentUsername={session.username} />;
}
