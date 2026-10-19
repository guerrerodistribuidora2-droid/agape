import { env } from "cloudflare:workers";
import type { ChatGPTUser } from "../app/chatgpt-auth";

export function isOrganizer(email: string): boolean {
  const allowlist = (env.AGAPE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}

export function organizerLabel(user: ChatGPTUser): string {
  return user.fullName ?? user.email;
}
