import {
  clerkClient,
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  isEmailAllowed,
  resolveUserEmail,
} from "@/lib/auth/allowed-emails";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/salary-slips(.*)",
  "/api/salary-slips(.*)",
  "/api/files/r2(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/sign-up")) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Server Actions POST to the current URL; auth redirects break action forwarding.
  const isServerAction = request.headers.has("next-action");
  const { userId, sessionId, sessionClaims } = await auth();

  if (userId && !isServerAction) {
    const email = await resolveUserEmail(
      userId,
      sessionClaims as Record<string, unknown> | null,
    );

    if (!isEmailAllowed(email)) {
      if (sessionId) {
        const client = await clerkClient();
        await client.sessions.revokeSession(sessionId);
      }

      if (!pathname.startsWith("/sign-in")) {
        const url = new URL("/sign-in", request.url);
        url.searchParams.set("error", "unauthorized");
        return NextResponse.redirect(url);
      }
    }
  }

  if (!isPublicRoute(request) && !isServerAction && !userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
