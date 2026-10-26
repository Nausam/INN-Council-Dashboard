function naturalJoin(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items[0] ?? "";
}

/** "Tue 20 Oct" for one day; "28 and 29 Sep, 1 and 2 Oct" for several. */
function daysLabel(dates: string[]): string {
  const days = dates.map((date) => new Date(`${date}T00:00:00Z`));
  const month = (day: Date) => day.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  if (days.length === 1) {
    return `${days[0].toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} ${days[0].getUTCDate()} ${month(days[0])}`;
  }
  const byMonth: Array<{ month: string; days: number[] }> = [];
  for (const day of days) {
    const last = byMonth[byMonth.length - 1];
    if (last?.month === month(day)) last.days.push(day.getUTCDate());
    else byMonth.push({ month: month(day), days: [day.getUTCDate()] });
  }
  return byMonth.map((group) => `${naturalJoin(group.days.map(String))} ${group.month}`).join(", ");
}

/**
 * Wording of HR's leave form reminder, shared by the sender and HR's preview.
 * Lists every day, so the employee knows each form to submit.
 */
export function leaveReminderMessage(dates: string[]): { title: string; body: string } {
  return dates.length === 1
    ? {
        title: "Leave form needed",
        body: `You were on leave on ${daysLabel(dates)}. Please submit the leave form in Requests.`,
      }
    : {
        title: `${dates.length} leave forms needed`,
        body: `You were on leave on ${daysLabel(dates)}. Please submit leave forms for these days in Requests.`,
      };
}
