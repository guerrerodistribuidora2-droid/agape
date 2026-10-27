import { createHash, createHmac } from "node:crypto";

type RuntimeVariables = Partial<Cloudflare.Env> & {
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  R2_ENDPOINT?: string;
};

const readEnv = (name: keyof RuntimeVariables) => process.env[name] || undefined;

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string, encoding?: "hex") {
  const digest = createHmac("sha256", key).update(value);
  return encoding ? digest.digest(encoding) : digest.digest();
}

function encodePath(value: string) {
  return value.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function makeR2Bucket(config: { endpoint: string; bucket: string; accessKey: string; secretKey: string }): R2Bucket {
  async function request(method: "GET" | "PUT" | "DELETE", key: string, body?: Uint8Array, metadata?: { contentType?: string; cacheControl?: string }) {
    const endpoint = new URL(config.endpoint);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) throw new Error("R2_ENDPOINT must be a credential-free HTTPS URL.");
    if (!key || key.startsWith("/") || key.split("/").some((part) => part === ".." || part === ".")) throw new Error("Invalid R2 object key.");
    const path = `${endpoint.pathname.replace(/\/$/, "")}/${encodeURIComponent(config.bucket)}/${encodePath(key)}`;
    const url = new URL(endpoint.origin + path);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = amzDate.slice(0, 8);
    const payloadHash = sha256(body || new Uint8Array());
    const requestHeaders: Record<string, string> = {
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (metadata?.contentType) requestHeaders["content-type"] = metadata.contentType;
    if (metadata?.cacheControl) requestHeaders["cache-control"] = metadata.cacheControl;
    const canonicalHeaderValues: Record<string, string> = { ...requestHeaders, host: url.host };
    const names = Object.keys(canonicalHeaderValues).sort();
    const canonicalHeaders = names.map((name) => `${name}:${canonicalHeaderValues[name].trim()}\n`).join("");
    const signedHeaders = names.join(";");
    const canonicalRequest = [method, url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${date}/auto/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
    const dateKey = hmac(`AWS4${config.secretKey}`, date);
    const regionKey = hmac(dateKey, "auto");
    const serviceKey = hmac(regionKey, "s3");
    const signingKey = hmac(serviceKey, "aws4_request");
    const signature = hmac(signingKey, stringToSign, "hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const response = await fetch(url, {
      method,
      headers: { ...requestHeaders, authorization },
      body: method === "PUT" && body ? Buffer.from(body) : undefined,
      cache: "no-store",
    });
    return response;
  }

  const bucket = {
    async put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }) {
      const body = value === null ? new Uint8Array() : new Uint8Array(await new Response(value as BodyInit).arrayBuffer());
      const response = await request("PUT", key, body, options?.httpMetadata);
      if (!response.ok) throw new Error(`R2 upload failed with status ${response.status}.`);
      return {};
    },
    async get(key: string) {
      const response = await request("GET", key);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`R2 download failed with status ${response.status}.`);
      return {
        body: response.body,
        httpMetadata: { contentType: response.headers.get("content-type") || undefined },
      };
    },
    async delete(key: string) {
      const response = await request("DELETE", key);
      if (!response.ok && response.status !== 404) throw new Error(`R2 delete failed with status ${response.status}.`);
    },
  };
  return bucket as unknown as R2Bucket;
}

const r2Endpoint = readEnv("R2_ENDPOINT");
const r2Bucket = readEnv("R2_BUCKET_NAME");
const r2AccessKey = readEnv("R2_ACCESS_KEY_ID");
const r2SecretKey = readEnv("R2_SECRET_ACCESS_KEY");

export const env: RuntimeVariables = {
  TURSO_DATABASE_URL: readEnv("TURSO_DATABASE_URL"),
  TURSO_AUTH_TOKEN: readEnv("TURSO_AUTH_TOKEN"),
  R2_ENDPOINT: r2Endpoint,
  R2_BUCKET_NAME: r2Bucket,
  R2_ACCESS_KEY_ID: r2AccessKey,
  R2_SECRET_ACCESS_KEY: r2SecretKey,
  AGAPE_ADMIN_EMAILS: readEnv("AGAPE_ADMIN_EMAILS"),
  AGAPE_ADMIN_USERNAME: readEnv("AGAPE_ADMIN_USERNAME"),
  AGAPE_ADMIN_PASSWORD_SALT: readEnv("AGAPE_ADMIN_PASSWORD_SALT"),
  AGAPE_ADMIN_PASSWORD_HASH: readEnv("AGAPE_ADMIN_PASSWORD_HASH"),
  AGAPE_ADMIN_SESSION_SECRET: readEnv("AGAPE_ADMIN_SESSION_SECRET"),
  PAYPHONE_TOKEN: readEnv("PAYPHONE_TOKEN"),
  PAYPHONE_STORE_ID: readEnv("PAYPHONE_STORE_ID"),
  RESEND_API_KEY: readEnv("RESEND_API_KEY"),
  AGAPE_EMAIL_FROM: readEnv("AGAPE_EMAIL_FROM"),
  AGAPE_TICKET_SIGNING_SECRET: readEnv("AGAPE_TICKET_SIGNING_SECRET"),
  SITE_BASE_URL: readEnv("SITE_BASE_URL"),
  BUCKET: r2Endpoint && r2Bucket && r2AccessKey && r2SecretKey
    ? makeR2Bucket({ endpoint: r2Endpoint, bucket: r2Bucket, accessKey: r2AccessKey, secretKey: r2SecretKey })
    : undefined,
};

