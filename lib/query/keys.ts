export const queryKeys = {
  employees: {
    all: ["employees"] as const,
    detail: (id: string) => ["employees", id] as const,
    options: ["employees", "options"] as const,
  },
  attendance: {
    council: (date: string) => ["attendance", "council", date] as const,
    mosque: (date: string) => ["attendance", "mosque", date] as const,
    councilMonth: (month: string) =>
      ["attendance", "council", "month", month] as const,
    mosqueMonth: (month: string) =>
      ["attendance", "mosque", "month", month] as const,
    mosqueDailyMonth: (month: string) =>
      ["attendance", "mosque", "daily", month] as const,
  },
  dashboard: {
    byDate: (date: string) => ["dashboard", date] as const,
  },
  prayerTimes: {
    byDate: (date: string) => ["prayer-times", date] as const,
    month: (month: string) => ["prayer-times", "month", month] as const,
    innamaadhooRange: (from: string, to: string) =>
      ["innamaadhoo", from, to] as const,
  },
  leave: {
    admin: (page: number, limit: number) =>
      ["leave-requests", "admin", page, limit] as const,
    user: (userId: string) => ["leave-requests", "user", userId] as const,
  },
  overtime: {
    admin: (page: number, limit: number) =>
      ["overtime-requests", "admin", page, limit] as const,
  },
  correspondence: {
    list: (filters: Record<string, string | number>) =>
      ["correspondence", "list", filters] as const,
    stats: ["correspondence", "stats"] as const,
    detail: (id: string) => ["correspondence", id] as const,
  },
  landRent: {
    overview: ["land-rent", "overview"] as const,
    leaseOptions: ["land-rent", "lease-options"] as const,
    statements: (leaseId: string, monthKey: string) =>
      ["land-rent", "statements", leaseId, monthKey] as const,
    preview: (leaseId: string, monthKey: string, capToEndDate: boolean) =>
      ["land-rent", "preview", leaseId, monthKey, capToEndDate] as const,
  },
  salarySlips: {
    uploaded: (period: string) => ["salary-slips", "uploaded", period] as const,
    byRecord: (recordCard: string) =>
      ["salary-slips", recordCard] as const,
  },
  mosque: {
    assistants: ["mosque", "assistants"] as const,
  },
} as const;
