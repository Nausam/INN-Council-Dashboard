import { EmployeeLeaveCalendarClient } from "./EmployeeLeaveCalendarClient";

/** Renders from the query cache while the access check runs, so cached data shows at once. */
export default function Loading() {
  return <EmployeeLeaveCalendarClient />;
}
