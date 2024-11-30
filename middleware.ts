import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "./lib/actions/user.actions";

export async function middleware(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/employees",
    "/employees/add",
    "/attendance/council",
    "/attendance/mosque",
    "/attendance/mosque/prayerTimes",
    "/reports/council",
    "/reports/mosque/daily",
    "/reports/mosque/monthly",
  ],
};
