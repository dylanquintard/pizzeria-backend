const DAY_DEFINITIONS = [
  { key: "MONDAY", dayIndex: 1, offsetFromAnchor: 0 },
  { key: "TUESDAY", dayIndex: 2, offsetFromAnchor: 1 },
  { key: "WEDNESDAY", dayIndex: 3, offsetFromAnchor: 2 },
  { key: "THURSDAY", dayIndex: 4, offsetFromAnchor: 3 },
  { key: "FRIDAY", dayIndex: 5, offsetFromAnchor: 4 },
  { key: "SATURDAY", dayIndex: 6, offsetFromAnchor: 5 },
  { key: "SUNDAY", dayIndex: 0, offsetFromAnchor: 6 },
];

const DAY_OF_WEEK_KEYS = DAY_DEFINITIONS.map((entry) => entry.key);
const DAY_INDEX_TO_KEY = DAY_DEFINITIONS.reduce((acc, entry) => {
  acc[entry.dayIndex] = entry.key;
  return acc;
}, {});

const ANCHOR_WEEK_START = new Date(2000, 0, 3, 0, 0, 0, 0);
const ANCHOR_WEEK_END = new Date(2000, 0, 10, 0, 0, 0, 0);

function parseDateTime(value, fieldName) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid`);
  }
  return date;
}

function parseIsoDate(value, fieldName = "date") {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} is invalid`);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error(`${fieldName} is invalid`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error(`${fieldName} is invalid`);
  }

  return parsed;
}

function formatIsoDate(value) {
  const date = parseDateTime(value, "date");
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTimeValue(value, fieldName = "time") {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is invalid`);
  }

  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value.trim());
  if (!match) {
    throw new Error(`${fieldName} is invalid`);
  }

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
    seconds: Number(match[3] || 0),
  };
}

function formatTimeValue(value) {
  const date = parseDateTime(value, "time");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function buildDateTime(dateValue, timeValue, fieldName = "time") {
  const baseDate = parseIsoDate(dateValue, "date");
  const { hours, minutes, seconds } = parseTimeValue(timeValue, fieldName);
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hours,
    minutes,
    seconds,
    0
  );
}

function addDays(dateValue, count) {
  const date = parseDateTime(dateValue, "date");
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + count);
  return next;
}

function parseDayOfWeek(value, fieldName = "dayOfWeek") {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (!DAY_OF_WEEK_KEYS.includes(normalized)) {
    throw new Error(
      `${fieldName} is invalid. Allowed values: ${DAY_OF_WEEK_KEYS.join(", ")}`
    );
  }

  return normalized;
}

function getDayOfWeekKey(dateValue) {
  const date = parseDateTime(dateValue, "date");
  return DAY_INDEX_TO_KEY[date.getDay()];
}

function getAnchorDateForDay(dayOfWeek) {
  const parsedDay = parseDayOfWeek(dayOfWeek);
  const definition = DAY_DEFINITIONS.find((entry) => entry.key === parsedDay);
  return addDays(ANCHOR_WEEK_START, definition.offsetFromAnchor);
}

function getDateRange(dateValue) {
  const start = parseIsoDate(dateValue, "date");
  const end = addDays(start, 1);
  return { start, end };
}

function minutesBetween(startValue, endValue) {
  const start = parseDateTime(startValue, "startTime");
  const end = parseDateTime(endValue, "endTime");
  const diff = end.getTime() - start.getTime();
  return Math.round(diff / 60_000);
}

module.exports = {
  DAY_DEFINITIONS,
  DAY_OF_WEEK_KEYS,
  ANCHOR_WEEK_START,
  ANCHOR_WEEK_END,
  parseDateTime,
  parseIsoDate,
  formatIsoDate,
  parseTimeValue,
  formatTimeValue,
  buildDateTime,
  addDays,
  parseDayOfWeek,
  getDayOfWeekKey,
  getAnchorDateForDay,
  getDateRange,
  minutesBetween,
};
