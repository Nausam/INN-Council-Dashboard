import type { EmployeeFormData } from "@/components/EmployeeForm";
import { creditSchemesForFirestore } from "@/lib/employees/credit-schemes";
import { computeRetirementPension } from "@/lib/employees/retirement-pension";

export function employeeFormDataForFirestore(formData: EmployeeFormData) {
  const { creditSchemes, ...rest } = formData;
  return {
    ...rest,
    retirementPension: computeRetirementPension(
      rest.basicSalary,
      rest.retirementPensionApplies,
    ),
    creditSchemes: creditSchemesForFirestore(creditSchemes),
  };
}
