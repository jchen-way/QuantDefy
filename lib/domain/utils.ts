import {
  DurationBucket,
  InsightReport,
  Trade,
  TradeFill,
  TradeDirection,
  TradeMetrics,
  TradeResult
} from "@/lib/domain/types";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function toCurrency(value: number, compact = false) {
  const minimumFractionDigits = Math.abs(value) < 1 ? 2 : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: Math.max(minimumFractionDigits, compact ? 1 : 0),
    minimumFractionDigits
  }).format(value);
}

export function toCurrencyWords(value: number) {
  const absolute = toCurrency(Math.abs(value));

  if (value > 0) {
    return `${absolute} up`;
  }

  if (value < 0) {
    return `${absolute} down`;
  }

  return `${absolute} flat`;
}

export function toDecimal(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }

  return `${value.toFixed(digits)}`;
}

export function toPercent(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }

  return `${value.toFixed(digits)}%`;
}

export function formatDuration(minutes: number | null) {
  if (minutes === null || Number.isNaN(minutes)) {
    return "Open";
  }

  const rounded = Math.max(Math.round(minutes), 0);

  if (rounded < 60) {
    return pluralize(rounded, "minute");
  }

  const days = Math.floor(rounded / (60 * 24));
  const hours = Math.floor((rounded % (60 * 24)) / 60);
  const remainingMinutes = rounded % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(pluralize(days, "day"));
  }

  if (hours > 0) {
    parts.push(pluralize(hours, "hour"));
  }

  if (remainingMinutes > 0 || parts.length === 0) {
    parts.push(pluralize(remainingMinutes, "minute"));
  }

  return parts.join(" ");
}

export function formatCapitalBucket(value: number) {
  if (value < 1000) {
    return "<$1k";
  }

  if (value < 5000) {
    return "$1k – $5k";
  }

  if (value < 8000) {
    return "$5k – $8k";
  }

  return "$8k+";
}

export function getTradeContractMultiplier(assetClass: Trade["assetClass"]) {
  return assetClass === "option" ? 100 : 1;
}

export function deriveCapitalAllocatedFromFills(
  fills: Array<Pick<TradeFill, "side" | "quantity" | "price">>,
  assetClass: Trade["assetClass"]
) {
  const multiplier = getTradeContractMultiplier(assetClass);
  let runningQuantity = 0;
  let runningCostBasis = 0;
  let maxCapitalUsed = 0;

  for (const fill of fills) {
    const quantity = Math.max(fill.quantity, 0);
    const fillNotional = quantity * fill.price * multiplier;

    if (fill.side === "entry") {
      runningQuantity += quantity;
      runningCostBasis += fillNotional;
    } else {
      const averageUnitCost = runningQuantity > 0 ? runningCostBasis / runningQuantity : fill.price * multiplier;
      const closedQuantity = Math.min(quantity, runningQuantity);
      runningQuantity = Math.max(runningQuantity - quantity, 0);
      runningCostBasis = Math.max(runningCostBasis - averageUnitCost * closedQuantity, 0);
    }

    maxCapitalUsed = Math.max(maxCapitalUsed, runningCostBasis);
  }

  return round(maxCapitalUsed, 2);
}

export function formatDateTime(iso: string | null) {
  if (!iso) {
    return "Open";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

function parseShortOffsetToMinutes(value: string) {
  if (value === "GMT" || value === "UTC") {
    return 0;
  }

  const match = value.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return 0;
  }

  const [, sign, hours, minutes] = match;
  const absoluteMinutes = Number(hours) * 60 + Number(minutes ?? "0");
  return sign === "-" ? -absoluteMinutes : absoluteMinutes;
}

function getFormatterParts(iso: string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    ...options
  }).formatToParts(new Date(iso));
}

function getNamedPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function formatShortDate(iso: string) {
  const target =
    /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(target);
}

export function getTimeZoneOffsetMinutesAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit"
  }).formatToParts(date);
  const offsetName = getNamedPart(parts, "timeZoneName");
  return parseShortOffsetToMinutes(offsetName);
}

export function parseDateTimeInTimeZone(value: string, timeZone: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

  if (!match) {
    throw new Error("Invalid date/time value.");
  }

  const [, year, month, day, hour, minute] = match;
  const baseUtcMillis = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );
  const firstOffset = getTimeZoneOffsetMinutesAt(new Date(baseUtcMillis), timeZone);
  let adjustedUtcMillis = baseUtcMillis - firstOffset * 60 * 1000;
  const secondOffset = getTimeZoneOffsetMinutesAt(new Date(adjustedUtcMillis), timeZone);

  if (secondOffset !== firstOffset) {
    adjustedUtcMillis = baseUtcMillis - secondOffset * 60 * 1000;
  }

  return new Date(adjustedUtcMillis).toISOString();
}

export function toInputDateTimeInTimeZone(
  iso: string | null | undefined,
  timeZone: string,
  fallbackToNow = true
) {
  if (!iso && !fallbackToNow) {
    return "";
  }

  const targetDate = iso ? new Date(iso) : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(targetDate);

  return `${getNamedPart(parts, "year")}-${getNamedPart(parts, "month")}-${getNamedPart(parts, "day")}T${getNamedPart(parts, "hour")}:${getNamedPart(parts, "minute")}`;
}

export function formatMonthLabel(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(new Date(iso));
}

export function isMonthKey(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}$/.test(value));
}

export function formatMonthKeyLabel(monthKey: string) {
  const date = new Date(`${monthKey}-01T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(date);
}

export function shiftMonthKey(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1, 12, 0, 0));
  return date.toISOString().slice(0, 7);
}

export function formatWeekday(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short"
  }).format(new Date(iso));
}

export function getDateKeyInTimeZone(iso: string, timeZone: string) {
  const parts = getFormatterParts(iso, timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return `${getNamedPart(parts, "year")}-${getNamedPart(parts, "month")}-${getNamedPart(parts, "day")}`;
}

export function getMonthKeyInTimeZone(iso: string, timeZone: string) {
  return getDateKeyInTimeZone(iso, timeZone).slice(0, 7);
}

export function formatMonthLabelInTimeZone(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    year: "numeric"
  }).format(new Date(iso));
}

export function formatWeekdayInTimeZone(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short"
  }).format(new Date(iso));
}

export function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function getResultColor(result: TradeResult) {
  switch (result) {
    case "win":
      return "text-green";
    case "loss":
      return "text-red";
    case "scratch":
      return "text-gold";
    default:
      return "text-muted";
  }
}

export function getDirectionLabel(direction: TradeDirection) {
  return direction === "long" ? "Long" : "Short";
}

export function toDurationBucket(minutes: number | null): DurationBucket {
  if (minutes === null) {
    return "open";
  }
  if (minutes <= 15) {
    return "scalp";
  }
  if (minutes <= 90) {
    return "intraday";
  }
  if (minutes <= 420) {
    return "session";
  }
  if (minutes <= 60 * 24 * 4) {
    return "swing";
  }
  return "position";
}

export function durationBucketLabel(bucket: DurationBucket) {
  switch (bucket) {
    case "scalp":
      return "Scalp";
    case "intraday":
      return "Intraday";
    case "session":
      return "Session";
    case "swing":
      return "Swing";
    case "position":
      return "Position";
    default:
      return "Open";
  }
}

export function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function sortTradesByOpenDate<T extends Trade>(trades: T[]) {
  return [...trades].sort((left, right) => {
    return new Date(right.openedAt).getTime() - new Date(left.openedAt).getTime();
  });
}

export function getMonday(iso: string) {
  const date = new Date(iso);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export function getWeekKey(iso: string) {
  return getMonday(iso).slice(0, 10);
}

export function getWeekKeyInTimeZone(iso: string, timeZone: string) {
  const date = new Date(`${getDateKeyInTimeZone(iso, timeZone)}T12:00:00Z`);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function pluralize(value: number, singular: string, plural?: string) {
  return `${value} ${value === 1 ? singular : plural ?? `${singular}s`}`;
}

export function buildInsightLabel(trade: Trade, metrics: TradeMetrics, insight?: InsightReport) {
  if (insight) {
    return insight.title;
  }

  return `${trade.symbol} ${metrics.result === "open" ? "in progress" : metrics.result}`;
}
