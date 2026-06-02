import type { EmployeeFormData } from "@/components/EmployeeForm";
import { creditSchemesForFirestore } from "@/lib/employees/credit-schemes";

export function employeeFormDataForFirestore(formData: EmployeeFormData) {
  const { creditSchemes, ...rest } = formData;
  return {
    ...rest,
    creditSchemes: creditSchemesForFirestore(creditSchemes),
  };
}
