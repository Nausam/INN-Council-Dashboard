export function maldivesDateTime(now = new Date()) {
  const dateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Indian/Maldives",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => dateParts.find((item) => item.type === type)?.value ?? "";
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const displayDate = `${part("day")}/${part("month")}/${part("year")}`;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Indian/Maldives",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return { date, displayDate, time };
}
