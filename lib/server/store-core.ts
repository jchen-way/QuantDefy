import { AppStore } from "@/lib/domain/types";
import { assertSupportedStoreBackend } from "@/lib/server/deployment-env";
import { readFileStore, writeFileStore } from "@/lib/server/store-file";
import { readNeonStore } from "@/lib/server/store-neon";
import { StoreBackend } from "@/lib/server/store-types";

export function getStoreBackend(): StoreBackend {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  assertSupportedStoreBackend(databaseUrl);
  return databaseUrl ? "neon" : "file";
}

export async function readStore(): Promise<AppStore> {
  if (getStoreBackend() === "neon") {
    return readNeonStore();
  }

  return readFileStore();
}

export async function writeStore(store: AppStore) {
  await writeFileStore(store);
}
