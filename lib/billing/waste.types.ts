export type WasteCustomer = {
  $id: string;
  fullName: string;
  idCard: string;
  idCardNumber: string;
  address: string;
  contactNumber: string;
  category: string;
};

export type WasteFrequency = "MONTHLY" | "QUARTERLY" | "YEARLY";

export type WasteSubscription = {
  $id: string;
  customerId: string;
  feeMvr: number;
  frequency: WasteFrequency;
  startMonth: string; // YYYY-MM
  endMonth?: string;
  status: "ACTIVE" | "PAUSED";
};

export type InvoiceStatus =
  | "ISSUED"
  | "OVERDUE"
  | "PARTIALLY_PAID"
  | "PAID"
  | "WAIVED"
  | "CANCELLED";
