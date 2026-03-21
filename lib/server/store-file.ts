import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { seedStore } from "@/data/seed";
import { buildInsightReportsForState } from "@/lib/server/store-insights";
import { getFileStorePath, getRuntimeDataDir } from "@/lib/server/runtime-paths";
import {
  AppStore,
  InsightReport,
  TradeAttachment,
  UserAccount,
  UserSettings
} from "@/lib/domain/types";

let storeWriteQueue: Promise<void> = Promise.resolve();

export function withDefaultStoreShape(store: AppStore): AppStore {
  return {
    users: store.users ?? [],
    sessions: store.sessions ?? [],
    trades: store.trades ?? [],
    insightReports: store.insightReports ?? [],
    filterPresets: store.filterPresets ?? [],
    settings: (store.settings ?? []).map((settings) => ({
      ...settings,
      insightMode: settings.insightMode ?? "local",
      customTradeTypes: settings.customTradeTypes ?? [],
      customSetupTypes: settings.customSetupTypes ?? []
    }))
  };
}

export function getAttachmentFileNames(attachments: TradeAttachment[]) {
  return attachments
    .map((attachment) => attachment.fileName)
    .filter((fileName): fileName is string => Boolean(fileName));
}

export function getRemovedAttachmentFileNames(previous: TradeAttachment[], next: TradeAttachment[]) {
  const nextNames = new Set(getAttachmentFileNames(next));
  return getAttachmentFileNames(previous).filter((fileName) => !nextNames.has(fileName));
}

export function refreshInsights(store: AppStore): AppStore {
  const nextStore = withDefaultStoreShape({
    ...store,
    insightReports: []
  });
  const insightReports: InsightReport[] = [];

  for (const settings of nextStore.settings) {
    const userTrades = nextStore.trades.filter((trade) => trade.userId === settings.userId);
    insightReports.push(...buildInsightReportsForState(userTrades, settings));
  }

  return {
    ...nextStore,
    insightReports
  };
}

function normalizeFileStore(store: AppStore | Record<string, unknown>): AppStore {
  const candidate = store as Partial<AppStore> & {
    settings?: UserSettings | UserSettings[];
  };

  if (Array.isArray(candidate.users) && Array.isArray(candidate.settings)) {
    return withDefaultStoreShape({
      ...candidate,
      filterPresets: (candidate.filterPresets ?? []).map((preset) => ({
        ...preset,
        userId: preset.userId ?? "user_demo"
      }))
    } as AppStore);
  }

  const legacySettings = Array.isArray(candidate.settings)
    ? candidate.settings
    : candidate.settings
      ? [candidate.settings]
      : [];

  const normalizedUsers: UserAccount[] =
    Array.isArray(candidate.users) && candidate.users.length > 0
      ? candidate.users
      : legacySettings.length > 0
        ? [
            {
              id: legacySettings[0].userId,
              email: legacySettings[0].email,
              displayName: legacySettings[0].displayName,
              passwordHash:
                "trade_demo_seed:bbc394fd8cfa98a3b309e3a8f25c683e54f3124ac308e44b81ed3de6aa1436186f58e0407c78368941a855fbfeebc83e4b044dc3d8a0212221be84e5bb4fd14d",
              createdAt: "2026-03-01T09:00:00-05:00"
            }
          ]
        : [];

  const normalizedStore = withDefaultStoreShape({
    users: normalizedUsers.map((user) =>
      user.id === "user_demo" && !user.passwordHash.includes(":")
        ? {
            ...user,
            passwordHash:
              "trade_demo_seed:bbc394fd8cfa98a3b309e3a8f25c683e54f3124ac308e44b81ed3de6aa1436186f58e0407c78368941a855fbfeebc83e4b044dc3d8a0212221be84e5bb4fd14d"
          }
        : user
    ),
    sessions: Array.isArray(candidate.sessions) ? candidate.sessions : [],
    trades: Array.isArray(candidate.trades) ? candidate.trades : [],
    insightReports: Array.isArray(candidate.insightReports) ? candidate.insightReports : [],
    filterPresets: Array.isArray(candidate.filterPresets)
      ? candidate.filterPresets.map((preset) => ({
          ...preset,
          userId: preset.userId ?? legacySettings[0]?.userId ?? "user_demo"
        }))
      : [],
    settings: legacySettings.map((settings) => ({
      ...settings,
      insightMode: settings.insightMode ?? "local",
      customTradeTypes: settings.customTradeTypes ?? [],
      customSetupTypes: settings.customSetupTypes ?? []
    }))
  });

  return refreshInsights(normalizedStore);
}

async function ensureFileStore() {
  const runtimeDir = getRuntimeDataDir();
  const storePath = getFileStorePath();
  await mkdir(runtimeDir, { recursive: true });

  try {
    await stat(storePath);
  } catch {
    const hydrated = refreshInsights(seedStore);
    await writeFile(storePath, JSON.stringify(hydrated, null, 2), "utf8");
  }
}

export async function writeFileStore(store: AppStore) {
  await ensureFileStore();
  await writeFile(getFileStorePath(), JSON.stringify(store, null, 2), "utf8");
}

export async function readFileStore(): Promise<AppStore> {
  await ensureFileStore();
  const storePath = getFileStorePath();
  const file = await readFile(storePath, "utf8");
  const parsed = JSON.parse(file) as AppStore | Record<string, unknown>;
  const normalized = normalizeFileStore(parsed);
  const shouldRewrite = JSON.stringify(parsed) !== JSON.stringify(normalized);

  if (shouldRewrite) {
    await writeFile(storePath, JSON.stringify(normalized, null, 2), "utf8");
  }

  return normalized;
}

export async function withStoreWriteLock<T>(operation: () => Promise<T>) {
  const next = storeWriteQueue.then(operation, operation);
  storeWriteQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}
