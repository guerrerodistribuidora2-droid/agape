declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    AGAPE_ADMIN_EMAILS?: string;
    AGAPE_ADMIN_USERNAME?: string;
    AGAPE_ADMIN_PASSWORD_SALT?: string;
    AGAPE_ADMIN_PASSWORD_HASH?: string;
    AGAPE_ADMIN_SESSION_SECRET?: string;
    PAYPHONE_TOKEN?: string;
    PAYPHONE_STORE_ID?: string;
    RESEND_API_KEY?: string;
    AGAPE_EMAIL_FROM?: string;
    AGAPE_TICKET_SIGNING_SECRET?: string;
    SITE_BASE_URL?: string;
    TURSO_DATABASE_URL?: string;
    TURSO_AUTH_TOKEN?: string;
  }
}
