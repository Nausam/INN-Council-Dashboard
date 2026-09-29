import {
  clerkClient,
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  getAllowedLoginEmails,
  isAnyEmailAllowed,
  resolveUserEmails,
} from "@/lib/auth/allowed-emails";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/employees/details/sign-in(.*)",
  "/employees/details(.*)",
  "/api/employee-requests/annual(.*)",
  "/salary-slips(.*)",
  "/api/salary-slips(.*)",
  "/api/files/r2(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;
  const isServerAction = request.headers.has("next-action");
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(request.headers.get("user-agent") ?? "");

  // Existing home-screen shortcuts may still launch at / or /sign-in rather
  // than the current manifest start URL. Send mobile entry to Employee Profile.
  if (
    !isServerAction && isMobile &&
    (pathname === "/" || pathname === "/sign-in" || pathname === "/sign-up" || pathname === "/employees/details/sign-in") &&
    request.nextUrl.searchParams.get("staff") !== "1"
  ) {
    return NextResponse.redirect(new URL("/employees/details", request.url));
  }

  // Employee Profile uses its own PIN session, even when Clerk is signed out.
  if (pathname === "/employees/details" || pathname.startsWith("/employees/details/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/sign-up")) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Server Actions POST to the current URL; auth redirects break action forwarding.
  const { userId, sessionId, sessionClaims } = await auth();

  if (userId && !isServerAction) {
    const allowed = getAllowedLoginEmails();
    if (allowed.size === 0) {
      console.error(
        "ALLOWED_LOGIN_EMAILS and ADMIN_EMAILS are empty — no users can sign in. Set one in .env.local and restart the dev server.",
      );
    }

    const claims = sessionClaims as Record<string, unknown> | null;
    const emails = await resolveUserEmails(userId, claims);

    if (!isAnyEmailAllowed(emails)) {
      if (sessionId) {
        const client = await clerkClient();
        await client.sessions.revokeSession(sessionId);
      }

      if (!pathname.startsWith("/sign-in") && !pathname.startsWith("/employees/details/sign-in")) {
        const signInPath = pathname.startsWith("/employees/details") ? "/employees/details/sign-in" : "/sign-in";
        const url = new URL(signInPath, request.url);
        url.searchParams.set("error", "unauthorized");
        return NextResponse.redirect(url);
      }
    }
  }

  if (!isPublicRoute(request) && !isServerAction && !userId) {
    const signInPath = pathname.startsWith("/employees/details") ? "/employees/details/sign-in" : "/sign-in";
    return NextResponse.redirect(new URL(signInPath, request.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
