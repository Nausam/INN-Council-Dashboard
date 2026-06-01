import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/salary-slips(.*)",
  "/api/salary-slips(.*)",
  "/api/files/r2(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  // Server Actions POST to the current URL; auth redirects break action forwarding.
  const isServerAction = request.headers.has("next-action");

  if (!isPublicRoute(request) && !isServerAction) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
