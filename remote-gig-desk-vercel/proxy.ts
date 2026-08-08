import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const auth = request.headers.get("authorization");

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
  if (auth?.startsWith("Basic ")) {
    const decoded = atob(auth.slice(6));
    const split = decoded.indexOf(":");
    if (split > -1 && decoded.slice(0, split) === expectedUser && decoded.slice(split + 1) === expectedPassword) {
      return NextResponse.next();
    }
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Remote Gig Desk", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.svg).*)"] };
