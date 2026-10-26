/** Wording of HR's leave form reminder, shared by the sender and HR's preview. */
export function leaveReminderMessage(date: string): { title: string; body: string } {
  const day = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return {
    title: "Leave form needed",
    body: `You were on leave on ${day}. Please submit the leave form in Requests.`,
  };
}
