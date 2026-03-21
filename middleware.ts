import { NextRequest, NextResponse } from "next/server";

const isProduction = process.env.NODE_ENV === "production";

function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function buildContentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self'${isProduction ? "" : " ws: wss:"}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'"
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const nonce = createNonce();
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"]
};
