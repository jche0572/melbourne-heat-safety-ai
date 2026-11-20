const ZONE = "Australia/Melbourne";

function partsAt(timestamp) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value]));
}

// Resolve wall-clock input in Melbourne independently of the device timezone.
// Reject nonexistent DST times; choose the earlier occurrence for repeated times.
export function toMelbourneIso(date, time) {
  const wall = `${date}T${time}:00`;
  for (const offset of ["+11:00", "+10:00"]) {
    const candidate = `${wall}${offset}`;
    const timestamp = Date.parse(candidate);
    if (!Number.isFinite(timestamp)) continue;
    const p = partsAt(timestamp);
    if (`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}` === wall) return candidate;
  }
  throw new Error("Please choose a valid Melbourne date and time (this time may not exist during daylight saving).");
}

export function eventTimeFields(startTime, endTime) {
  const fields = {};
  for (const [prefix, value] of [["start", startTime], ["end", endTime]]) {
    if (!Number.isFinite(Date.parse(value))) throw new Error("Invalid suggested time");
    const p = partsAt(Date.parse(value));
    fields[`${prefix}Date`] = `${p.year}-${p.month}-${p.day}`;
    fields[`${prefix}Time`] = `${p.hour}:${p.minute}`;
    fields[`${prefix}DateDisplay`] = new Date(value).toLocaleDateString("en-AU", {
      timeZone: ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    fields[`${prefix}TimeDisplay`] = new Date(value).toLocaleTimeString("en-AU", {
      timeZone: ZONE, hour: "numeric", minute: "2-digit",
    });
  }
  return fields;
}
