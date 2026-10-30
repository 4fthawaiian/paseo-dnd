import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { JsonValue } from "@getpaseo/protocol/agent-types";

const SAVES_DIR = join(
  homedir(),
  ".paseo",
  "plugin-settings",
  "paseo-dnd",
  "saves",
);

const HISTORY_CAP = 30;

export interface AdventureRecord {
  agentId: string;
  createdAt: string;
  updatedAt: string;
  turnCount: number;
  latest: JsonValue;
  history: Array<{ at: string; state: JsonValue }>;
}

function recordPath(agentId: string): string {
  return join(SAVES_DIR, `${agentId}.json`);
}

export async function loadRecord(agentId: string): Promise<AdventureRecord | null> {
  try {
    return JSON.parse(await readFile(recordPath(agentId), "utf8"));
  } catch {
    return null;
  }
}

export async function saveRecord(
  agentId: string,
  state: JsonValue,
): Promise<AdventureRecord> {
  const now = new Date().toISOString();
  const prev = await loadRecord(agentId);
  const history = [...(prev?.history ?? []), { at: now, state }].slice(
    -HISTORY_CAP,
  );
  const record: AdventureRecord = {
    agentId,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    turnCount: (prev?.turnCount ?? 0) + 1,
    latest: state,
    history,
  };
  await mkdir(SAVES_DIR, { recursive: true });
  await writeFile(recordPath(agentId), JSON.stringify(record, null, 2));
  return record;
}
