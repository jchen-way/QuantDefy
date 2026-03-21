import { AttachmentKind, TagCategory } from "@/lib/domain/types";

export const assetClassOptions = [
  { value: "stock", label: "Stock" },
  { value: "option", label: "Option" }
] as const;

export const directionOptions = [
  { value: "long", label: "Long" },
  { value: "short", label: "Short" }
] as const;

export const timezoneOptions = [
  { value: "America/New_York", label: "Eastern Time", detail: "America/New_York" },
  { value: "America/Chicago", label: "Central Time", detail: "America/Chicago" },
  { value: "America/Denver", label: "Mountain Time", detail: "America/Denver" },
  { value: "America/Los_Angeles", label: "Pacific Time", detail: "America/Los_Angeles" },
  { value: "America/Phoenix", label: "Arizona", detail: "America/Phoenix" },
  { value: "America/Anchorage", label: "Alaska", detail: "America/Anchorage" },
  { value: "Pacific/Honolulu", label: "Hawaii", detail: "Pacific/Honolulu" },
  { value: "Europe/London", label: "London", detail: "Europe/London" },
  { value: "Europe/Paris", label: "Central Europe", detail: "Europe/Paris" },
  { value: "Asia/Dubai", label: "Dubai", detail: "Asia/Dubai" },
  { value: "Asia/Singapore", label: "Singapore", detail: "Asia/Singapore" },
  { value: "Asia/Tokyo", label: "Tokyo", detail: "Asia/Tokyo" },
  { value: "Australia/Sydney", label: "Sydney", detail: "Australia/Sydney" }
] as const;

export const tradeStatusOptions = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" }
] as const;

export const tradeTypeOptions = [
  { value: "opening-drive", label: "Opening drive" },
  { value: "trend-continuation", label: "Trend continuation" },
  { value: "breakout", label: "Breakout" },
  { value: "reversal", label: "Reversal" },
  { value: "swing", label: "Swing" },
  { value: "news-reaction", label: "News reaction" },
  { value: "options-premium", label: "Options premium" }
] as const;

export const setupTypeOptions = [
  { value: "orb", label: "ORB" },
  { value: "trend-pullback", label: "Trend pullback" },
  { value: "failed-breakout", label: "Failed breakout" },
  { value: "support-reclaim", label: "Support reclaim" },
  { value: "earnings-follow-through", label: "Earnings follow through" },
  { value: "supply-reversal", label: "Supply reversal" },
  { value: "gamma-momentum", label: "Gamma momentum" }
] as const;

export const attachmentKindOptions: Array<{ value: AttachmentKind; label: string }> = [
  { value: "setup", label: "Setup" },
  { value: "entry", label: "Entry" },
  { value: "exit", label: "Exit" },
  { value: "winner", label: "Winner" },
  { value: "loser", label: "Loser" },
  { value: "postmortem", label: "Postmortem" }
];

export const tagCategoryOptions: Array<{ value: TagCategory; label: string }> = [
  { value: "setup", label: "Setup" },
  { value: "mistake", label: "Mistake" },
  { value: "emotion", label: "Emotion" },
  { value: "lesson", label: "Lesson" }
];

export const tradeTypeValues = tradeTypeOptions.map((option) => option.value) as [
  (typeof tradeTypeOptions)[number]["value"],
  ...Array<(typeof tradeTypeOptions)[number]["value"]>
];

export const setupTypeValues = setupTypeOptions.map((option) => option.value) as [
  (typeof setupTypeOptions)[number]["value"],
  ...Array<(typeof setupTypeOptions)[number]["value"]>
];

export const attachmentKindValues = attachmentKindOptions.map((option) => option.value) as [
  AttachmentKind,
  ...AttachmentKind[]
];

export const tagCategoryValues = tagCategoryOptions.map((option) => option.value) as [
  TagCategory,
  ...TagCategory[]
];
