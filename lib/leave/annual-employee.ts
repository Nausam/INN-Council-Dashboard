import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { fetchEmployeeById } from "@/lib/firebase/hr";
import type { EmployeeDoc } from "@/lib/firebase/types";

export async function findAnnualLeaveEmployee(request: {
  employeeId?: string;
  fullName?: string;
}): Promise<EmployeeDoc | null> {
  if (request.employeeId) {
    const employee = await fetchEmployeeById(request.employeeId).catch(() => null);
    if (employee) return employee;
  }
  const name = request.fullName?.trim();
  if (!name) return null;
  const matches = await getFirestoreDb().collection(COLLECTIONS.employees)
    .where("name", "==", name).limit(2).get();
  if (matches.size !== 1) return null;
  return fetchEmployeeById(matches.docs[0].id).catch(() => null);
}
