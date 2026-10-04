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
  // Checks admin or Employee Profile access itself, so the PIN-only app can load photos.
  "/api/employee-photos(.*)",
  "/salary-slips(.*)",
  "/api/salary-slips(.*)",
  "/api/files/r2(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;
  const isServerAction = request.headers.has("next-action");
  // The installed Employee Profile app is kept on /employees/details by
  // EmployeePwaScope, which can see display-mode: standalone. The server can't
  // tell the app from a phone browser, so it doesn't redirect by device here.

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
