import { headers } from "next/headers";
import { getChatGPTUser } from "../chatgpt-auth";
import { adminSessionFromCookie, isOrganizer } from "../../lib/admin-auth";
import AdminDashboard from "./AdminDashboard";
import AdminLogin from "./AdminLogin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const requestHeaders = await headers();
  const session = await adminSessionFromCookie(requestHeaders.get("cookie"));
  const user = await getChatGPTUser();
  if (!session && !(user && isOrganizer(user.email))) return <AdminLogin />;
  const label = session?.username ?? user?.fullName ?? user?.email ?? "Ágape";
  return <AdminDashboard organizerName={label} />;
}
