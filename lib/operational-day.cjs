const STORE_TIMEZONE_OFFSET_MINUTES = -180;
const OPERATIONAL_DAY_CUTOFF_MINUTES = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad2 = (value) => String(value).padStart(2, "0");

const toTimestamp = (value) => {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : NaN;
};

const getStoreCalendarParts = (value) => {
  const timestamp = toTimestamp(value);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const offsetMs = STORE_TIMEZONE_OFFSET_MINUTES * 60 * 1000;
  const storeTime = new Date(timestamp + offsetMs);
  return {
    year: storeTime.getUTCFullYear(),
    month: storeTime.getUTCMonth(),
    day: storeTime.getUTCDate(),
    minuteOfDay: storeTime.getUTCHours() * 60 + storeTime.getUTCMinutes(),
  };
};

const getOperationalDateBaseMs = (value) => {
  const parts = getStoreCalendarParts(value);

  if (!parts) {
    return NaN;
  }

  const calendarBaseMs = Date.UTC(parts.year, parts.month, parts.day);
  return parts.minuteOfDay < OPERATIONAL_DAY_CUTOFF_MINUTES
    ? calendarBaseMs - DAY_MS
    : calendarBaseMs;
};

const formatOperationalDateKeyFromBaseMs = (baseMs) => {
  const date = new Date(baseMs);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
};

const toOperationalDateInput = (value) => {
  const baseMs = getOperationalDateBaseMs(value);
  return Number.isFinite(baseMs) ? formatOperationalDateKeyFromBaseMs(baseMs) : "";
};

const operationalDateKeyToStartMs = (dateValue) => {
  const parts = String(dateValue || "")
    .trim()
    .split("-");

  if (parts.length !== 3) {
    return NaN;
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return NaN;
  }

  const offsetMs = STORE_TIMEZONE_OFFSET_MINUTES * 60 * 1000;
  const cutoffMs = OPERATIONAL_DAY_CUTOFF_MINUTES * 60 * 1000;
  return Date.UTC(year, month - 1, day) + cutoffMs - offsetMs;
};

const buildOperationalWindow = (startMs, endMs) => {
  const safeStartMs = Number.isFinite(startMs) ? startMs : Date.now();
  const safeEndMs = Number.isFinite(endMs) && endMs > safeStartMs ? endMs : safeStartMs + DAY_MS;

  return {
    startMs: safeStartMs,
    endMs: safeEndMs,
    startIso: new Date(safeStartMs).toISOString(),
    endIso: new Date(safeEndMs).toISOString(),
    startDate: toOperationalDateInput(safeStartMs),
    endDate: toOperationalDateInput(safeEndMs - 1),
    dayCount: Math.max(1, Math.round((safeEndMs - safeStartMs) / DAY_MS)),
    cutoffMinutes: OPERATIONAL_DAY_CUTOFF_MINUTES,
    cutoffTime: `${pad2(Math.floor(OPERATIONAL_DAY_CUTOFF_MINUTES / 60))}:${pad2(
      OPERATIONAL_DAY_CUTOFF_MINUTES % 60
    )}`,
  };
};

const getOperationalDayWindow = (referenceDate = new Date()) => {
  const operationalDateBaseMs = getOperationalDateBaseMs(referenceDate);

  if (!Number.isFinite(operationalDateBaseMs)) {
    return buildOperationalWindow(Date.now(), Date.now() + DAY_MS);
  }

  return buildOperationalWindow(
    operationalDateKeyToStartMs(formatOperationalDateKeyFromBaseMs(operationalDateBaseMs)),
    operationalDateKeyToStartMs(formatOperationalDateKeyFromBaseMs(operationalDateBaseMs)) + DAY_MS
  );
};

const buildOperationalWindowForPreset = (period, now = new Date()) => {
  const todayWindow = getOperationalDayWindow(now);

  if (period === "today") {
    return todayWindow;
  }

  if (period === "30d") {
    return buildOperationalWindow(todayWindow.startMs - 29 * DAY_MS, todayWindow.endMs);
  }

  return buildOperationalWindow(todayWindow.startMs - 6 * DAY_MS, todayWindow.endMs);
};

const parseOperationalCustomWindow = (startDate, endDate, now = new Date()) => {
  const startValue = String(startDate || "").trim();
  const endValue = String(endDate || "").trim();
  const isValidDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

  if (!isValidDateString(startValue) || !isValidDateString(endValue)) {
    return buildOperationalWindowForPreset("7d", now);
  }

  const startMs = operationalDateKeyToStartMs(startValue);
  const endMs = operationalDateKeyToStartMs(endValue);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return buildOperationalWindowForPreset("7d", now);
  }

  return buildOperationalWindow(Math.min(startMs, endMs), Math.max(startMs, endMs) + DAY_MS);
};

const isWithinOperationalWindow = (value, window) => {
  const timestamp = toTimestamp(value);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return timestamp >= Number(window?.startMs || 0) && timestamp < Number(window?.endMs || 0);
};

module.exports = {
  DAY_MS,
  OPERATIONAL_DAY_CUTOFF_MINUTES,
  STORE_TIMEZONE_OFFSET_MINUTES,
  buildOperationalWindow,
  buildOperationalWindowForPreset,
  getOperationalDayWindow,
  isWithinOperationalWindow,
  operationalDateKeyToStartMs,
  parseOperationalCustomWindow,
  toOperationalDateInput,
  toTimestamp,
};
