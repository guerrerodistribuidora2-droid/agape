declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    AGAPE_ADMIN_EMAILS?: string;
    AGAPE_ADMIN_USERNAME?: string;
    AGAPE_ADMIN_PASSWORD_SALT?: string;
    AGAPE_ADMIN_PASSWORD_HASH?: string;
    AGAPE_ADMIN_SESSION_SECRET?: string;
  }
}
