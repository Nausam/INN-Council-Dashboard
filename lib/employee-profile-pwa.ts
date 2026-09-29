export const EMPLOYEE_PROFILE_HOME = "/employees/details";
export const LAST_EMPLOYEE_PROFILE_KEY = "employee-profile-last-id";

export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isEmployeeProfileRoute(pathname: string): boolean {
  return pathname === EMPLOYEE_PROFILE_HOME
    || pathname.startsWith(`${EMPLOYEE_PROFILE_HOME}/`)
    || pathname === "/sign-in";
}
