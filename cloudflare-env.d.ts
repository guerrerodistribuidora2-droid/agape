declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    AGAPE_ADMIN_EMAILS?: string;
  }
}
