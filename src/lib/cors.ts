import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = [
  "https://addin.trustello.de",
  "http://localhost:3001",
  "https://localhost:3001",
];

export function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? "");
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export function handleOptions(request: NextRequest): Response {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}
