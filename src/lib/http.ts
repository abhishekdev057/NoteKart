import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./session";

/**
 * Convert a thrown error into a safe JSON response.
 *
 * Auth and validation errors carry client-safe messages; everything else is
 * logged server-side and returned as a generic 500 so we never leak internal
 * detail (DB errors, stack traces, env state) to the client.
 */
export function errorResponse(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request.", details: error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  console.error("[notekart] unhandled route error:", error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** Best-effort client IP for rate limiting (works behind Vercel/most proxies). */
export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
