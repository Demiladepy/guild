import * as ed from "@noble/ed25519";

type Jwk = { kty: "OKP"; crv: "Ed25519"; kid: string; x: string };
type Jwks = { keys: Jwk[] };

const JWKS_URL = "https://relayer.1shotapi.com/.well-known/jwks.json";
const JWKS_TTL_MS = 10 * 60_000;

let jwksCache: { fetchedAt: number; keys: Map<string, Uint8Array> } | null =
  null;

function base64urlToBytes(b64url: string): Uint8Array {
  const padded = b64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), "=");
  return new Uint8Array(Buffer.from(padded, "base64"));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([a], [b]) => a.localeCompare(b),
  );
  return `{${entries
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    .join(",")}}`;
}

async function getJwks(force = false): Promise<Map<string, Uint8Array>> {
  if (
    !force &&
    jwksCache &&
    Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS
  ) {
    return jwksCache.keys;
  }

  const response = await fetch(JWKS_URL);
  if (!response.ok) {
    throw new Error(`JWKS fetch failed: ${response.status}`);
  }

  const { keys } = (await response.json()) as Jwks;
  const map = new Map<string, Uint8Array>();
  for (const key of keys) {
    if (key.kty === "OKP" && key.crv === "Ed25519") {
      map.set(key.kid, base64urlToBytes(key.x));
    }
  }

  jwksCache = { fetchedAt: Date.now(), keys: map };
  return map;
}

export async function verifyRelayerWebhook(
  body: Record<string, unknown>,
): Promise<boolean> {
  const signature = body.signature;
  const keyId = body.keyId;
  if (typeof signature !== "string" || typeof keyId !== "string") {
    return false;
  }

  let keys = await getJwks();
  let publicKey = keys.get(keyId);
  if (!publicKey) {
    keys = await getJwks(true);
    publicKey = keys.get(keyId);
    if (!publicKey) return false;
  }

  const { signature: _omit, ...rest } = body;
  const message = new TextEncoder().encode(stableStringify(rest));
  const sig = new Uint8Array(Buffer.from(signature, "base64"));
  return ed.verifyAsync(sig, message, publicKey);
}
