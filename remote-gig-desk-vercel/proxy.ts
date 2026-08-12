import { NextRequest, NextResponse } from "next/server";

const DEVICE_COOKIE = "remote_gig_desk_device";
const DEVICE_DAYS = 90;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function createDeviceToken(secret: string) {
  const expires = Date.now() + DEVICE_DAYS * 24 * 60 * 60 * 1000;
  const payload = "v1." + expires;
  return payload + "." + await signature(payload, secret);
}

async function validDeviceToken(token: string | undefined, secret: string) {
  if (!token) return false;
  const [version, rawExpires, supplied] = token.split(".");
  if (version !== "v1" || !rawExpires || !supplied || Number(rawExpires) <= Date.now()) return false;
  const expected = await signature(version + "." + rawExpires, secret);
  if (supplied.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < supplied.length; index++) mismatch |= supplied.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}

export async function proxy(request: NextRequest) {
  const auth = request.headers.get("authorization");

  if (request.nextUrl.pathname === "/api/health" && request.method === "GET") {
    return NextResponse.next();
  }

  // Paired Chrome agents use a revocable bearer token on this route.
  // The route itself validates the token hash before accepting a heartbeat.
  if (
    request.nextUrl.pathname === "/api/connections" &&
    (request.method === "OPTIONS" || auth?.startsWith("Bearer "))
  ) {
    return NextResponse.next();
  }

  const expectedUser = process.env.WORKBENCH_USER;
  const expectedPassword = process.env.WORKBENCH_PASSWORD;
  if (!expectedUser || !expectedPassword) {
    return new NextResponse("Workbench authentication is not configured", { status: 503 });
  }
  const deviceSecret = process.env.DEVICE_SESSION_SECRET || expectedPassword;
  if (await validDeviceToken(request.cookies.get(DEVICE_COOKIE)?.value, deviceSecret)) {
    return NextResponse.next();
  }
  if (auth?.startsWith("Basic ")) {
    const decoded = atob(auth.slice(6));
    const split = decoded.indexOf(":");
    if (split > -1 && decoded.slice(0, split) === expectedUser && decoded.slice(split + 1) === expectedPassword) {
      const response = NextResponse.next();
      response.cookies.set(DEVICE_COOKIE, await createDeviceToken(deviceSecret), {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: DEVICE_DAYS * 24 * 60 * 60,
      });
      return response;
    }
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Remote Gig Desk", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.svg).*)"] };
