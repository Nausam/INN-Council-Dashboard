import { Client, Databases } from "node-appwrite";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const CUSTOMERS = {
  endpoint: must("APPWRITE_CUSTOMERS_ENDPOINT"),
  projectId: must("APPWRITE_CUSTOMERS_PROJECT_ID"),
  apiKey: must("APPWRITE_CUSTOMERS_API_KEY"),
  dbId: must("APPWRITE_CUSTOMERS_DB_ID"),
  colWasteCustomers: must("APPWRITE_CUSTOMERS_COL_WASTE_CUSTOMERS"),
};

export const BILLING = {
  endpoint: must("APPWRITE_BILLING_ENDPOINT"),
  projectId: must("APPWRITE_BILLING_PROJECT_ID"),
  apiKey: must("APPWRITE_BILLING_API_KEY"),
  dbId: must("APPWRITE_BILLING_DB_ID"),
  colWasteSubs: must("APPWRITE_BILLING_COL_WASTE_SUBSCRIPTIONS"),
  colInvoices: must("APPWRITE_BILLING_COL_INVOICES"),
  colInvoiceItems: must("APPWRITE_BILLING_COL_INVOICE_ITEMS"),
  colPayments: must("APPWRITE_BILLING_COL_PAYMENTS"),
  colAllocations: must("APPWRITE_BILLING_COL_PAYMENT_ALLOCATIONS"),
  colCounters: must("APPWRITE_BILLING_COL_COUNTERS"),
  colAudit: must("APPWRITE_BILLING_COL_AUDIT_LOGS"),
};

export function createCustomersAdmin() {
  const client = new Client()
    .setEndpoint(CUSTOMERS.endpoint)
    .setProject(CUSTOMERS.projectId)
    .setKey(CUSTOMERS.apiKey);

  return { db: new Databases(client) };
}

export function createBillingAdmin() {
  const client = new Client()
    .setEndpoint(BILLING.endpoint)
    .setProject(BILLING.projectId)
    .setKey(BILLING.apiKey);

  return { db: new Databases(client) };
}
