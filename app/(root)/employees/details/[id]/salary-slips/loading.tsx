import EmployeeSalarySlipsPage from "../../../[id]/salary-slips/page";

/** Renders from the query cache while the access check runs, so cached slips show at once. */
export default function Loading() {
  return <EmployeeSalarySlipsPage />;
}
