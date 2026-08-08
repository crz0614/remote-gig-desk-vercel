const enc = new TextEncoder();
const dec = new TextDecoder();

async function key() {
  const secret = process.env.WORKBENCH_PASSWORD;
  if (!secret) throw new Error("WORKBENCH_PASSWORD is not configured");
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function seal(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), enc.encode(value)));
  return Buffer.concat([Buffer.from(iv), Buffer.from(ciphertext)]).toString("base64url");
}

export async function unseal(value: string) {
  const bytes = Buffer.from(value, "base64url");
  const iv = bytes.subarray(0, 12);
  const ciphertext = bytes.subarray(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await key(), ciphertext);
  return dec.decode(plain);
}
