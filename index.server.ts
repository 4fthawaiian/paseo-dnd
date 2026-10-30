import type {
  PluginHandlerContext,
  PluginServerContext,
} from "@getpaseo/plugin/server";
import type { JsonValue } from "@getpaseo/protocol/agent-types";
import { inspectTimelineRpc } from "./shared/inspect";
import { STATE_MARKER, ROLL_MARKER, MAP_MARKER, MAP_END } from "./shared/dnd";
import {
  outcomeMessage,
  parseRollSpec,
  rollDice,
  specToString,
} from "./shared/dice";
import { loadRecord, saveRecord } from "./server/state";

type PaseoApi = PluginHandlerContext["paseo"];

const RESYNC_MIN_GAP_MS = 3 * 60 * 1000;
const lastResyncAt = new Map<string, number>();
const knownGames = new Set<string>();

function parseState(text: string): JsonValue | null {
  const idx = text.indexOf(STATE_MARKER);
  if (idx === -1) return null;
  const raw = text.slice(idx + STATE_MARKER.length).trim();
  try {
    return JSON.parse(raw) as JsonValue;
  } catch {
    const end = raw.lastIndexOf("}");
    if (end > 0) {
      try {
        return JSON.parse(raw.slice(0, end + 1)) as JsonValue;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function parseMap(
  text: string,
): { title: string | null; grid: string[]; legend: { glyph: string; label: string }[] } | null {
  const start = text.indexOf(MAP_MARKER);
  if (start === -1) return null;
  const after = text.slice(start + MAP_MARKER.length);
  const nl = after.indexOf("\n");
  const title = (nl === -1 ? after : after.slice(0, nl)).trim() || null;
  const rest = nl === -1 ? "" : after.slice(nl + 1);
  let body = rest;
  const endIdx = body.indexOf(MAP_END);
  if (endIdx !== -1) body = body.slice(0, endIdx);
  const stateIdx = body.indexOf(STATE_MARKER);
  if (stateIdx !== -1) body = body.slice(0, stateIdx);
  const grid = body
    .replace(/\n+$/, "")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.length > 0);
  if (!grid.length) return null;
  // Legend lines live between ⟦/MAP⟧ and ⟦STATE⟧: "X label — Y label — ..."
  const legend: { glyph: string; label: string }[] = [];
  if (endIdx !== -1) {
    let tail = rest.slice(endIdx + MAP_END.length);
    const sIdx = tail.indexOf(STATE_MARKER);
    if (sIdx !== -1) tail = tail.slice(0, sIdx);
    for (const part of tail.split(/\s+[—–-]\s+|\n+/)) {
      const m = /^\s*(\S)\s+(.+?)\s*$/.exec(part);
      if (m) legend.push({ glyph: m[1], label: m[2].slice(0, 40) });
    }
  }
  return { title, grid, legend };
}

function resyncMessage(record: { latest: JsonValue }): string {
  return [
    `[GM screen] You dropped the ${STATE_MARKER} line (or the context was compacted). Canonical state: ${JSON.stringify(record.latest)}`,
    `Continue from this state — do not contradict it — and end every reply with ${STATE_MARKER}{...} exactly as instructed.`,
  ].join("\n");
}

async function maybeResync(
  agentId: string,
  handle: ReturnType<PaseoApi["agents"]["ref"]>,
  reason: string,
): Promise<void> {
  const last = lastResyncAt.get(agentId) ?? 0;
  if (Date.now() - last < RESYNC_MIN_GAP_MS) return;
  const record = await loadRecord(agentId);
  if (!record) return;
  lastResyncAt.set(agentId, Date.now());
  try {
    await handle.send(resyncMessage(record));
    console.log(`[paseo-dnd] resync sent (${reason}) agent=${agentId}`);
  } catch (error) {
    console.log(`[paseo-dnd] resync failed: ${String(error)}`);
  }
}

async function inspectTimeline(agentId: string, paseo: PaseoApi) {
  const handle = paseo.agents.ref(agentId);
  const page = await handle.timeline.refetch({ limit: 60 });
  const items = page.entries.map((entry) => {
    const item = entry.item;
    const text = "text" in item && typeof item.text === "string" ? item.text : "";
    return {
      type: item.type,
      hasMarker: text.includes(STATE_MARKER),
      len: text.length,
      preview: text.slice(-140),
    };
  });
  console.log(`[paseo-dnd] inspect ${agentId}: ${JSON.stringify(items)}`);
  return { items };
}

export default function contribute(server: PluginServerContext) {
  server.handle(inspectTimelineRpc, async (input, { paseo }) =>
    inspectTimeline(input.agentId, paseo),
  );

  server.on("agent.turn_ended", async (event, { paseo }) => {
    const handle = paseo.agents.ref(event.agent.id);
    const lastAssistant = [...event.timeline]
      .reverse()
      .find((i) => i.type === "assistant_message");
    const text =
      lastAssistant && lastAssistant.type === "assistant_message"
        ? lastAssistant.text
        : "";
    // Markers are contractually the final line of a DM reply. Checking the
    // last line only avoids false hits when the marker text appears mid-prose
    // (e.g. an agent documenting the syntax, as happened in the wild).
    const lastLine = text.trimEnd().split("\n").pop() ?? "";
    const hasState = lastLine.startsWith(STATE_MARKER);
    const hasRoll = lastLine.startsWith(ROLL_MARKER);
    const compacted = event.timeline
      .slice(-10)
      .some((i) => i.type === "compaction");
    console.log(
      `[paseo-dnd] turn_ended agent=${event.agent.id} state=${hasState} roll=${hasRoll} compacted=${compacted}`,
    );

    // --- Dice: DM requested a real roll (game agents only) ----------------
    if (hasRoll && (knownGames.has(event.agent.id) || (await loadRecord(event.agent.id)))) {
      knownGames.add(event.agent.id);
      const spec = parseRollSpec(text.slice(text.indexOf(ROLL_MARKER) + ROLL_MARKER.length));
      if (spec) {
        const outcome = rollDice(spec);
        try {
          await handle.timeline.append({
            type: "plugin",
            id: `dnd-roll-${event.turnId ?? `t${Date.now()}`}`,
            kind: "dnd-roll",
            version: 1,
            data: {
              label: spec.label,
              spec: specToString(spec),
              rolls: outcome.rolls,
              total: outcome.total,
              dc: spec.dc,
              success: outcome.success,
            },
          });
        } catch (error) {
          console.log(`[paseo-dnd] roll card failed: ${String(error)}`);
        }
        try {
          await handle.send(outcomeMessage(outcome));
        } catch (error) {
          console.log(`[paseo-dnd] roll outcome send failed: ${String(error)}`);
        }
      } else {
        console.log(`[paseo-dnd] roll marker but unparseable spec, agent=${event.agent.id}`);
      }
      return;
    }

    // --- State: persist + pin card at tail --------------------------------
    if (hasState) {
      knownGames.add(event.agent.id);
      const state = parseState(text);
      if (state) {
        try {
          const record = await saveRecord(event.agent.id, state);
          const newId = `dnd-state-${event.turnId ?? `t${Date.now()}`}`;
          await handle.timeline.append({
            type: "plugin",
            id: newId,
            kind: "dnd-state",
            version: 1,
            data: { state: record.latest },
          });
          // Optional ASCII map block → its own card row.
          const map = parseMap(text);
          let mapId: string | null = null;
          if (map) {
            mapId = `dnd-map-${event.turnId ?? `t${Date.now()}`}`;
            try {
              await handle.timeline.append({
                type: "plugin",
                id: mapId,
                kind: "dnd-map",
                version: 1,
                data: { title: map.title, grid: map.grid, legend: map.legend },
              });
            } catch (error) {
              console.log(`[paseo-dnd] map card failed: ${String(error)}`);
            }
          }
          // Tombstone every other card row so only the current ones show.
          const page = await handle.timeline.refetch({ limit: 80 });
          const stale = page.entries.filter(
            (e) =>
              e.item.type === "plugin" &&
              typeof e.item.id === "string" &&
              (e.item.id.startsWith("dnd-state") ||
                e.item.id.startsWith("dnd-map")) &&
              e.item.id !== newId &&
              e.item.id !== mapId,
          );
          for (const entry of stale) {
            if (entry.item.type !== "plugin" || !entry.item.id) continue;
            const isMap = entry.item.id.startsWith("dnd-map");
            try {
              await handle.timeline.append({
                type: "plugin",
                id: entry.item.id,
                kind: isMap ? "dnd-map" : "dnd-state",
                version: 1,
                data: isMap ? { title: null, grid: [] } : { state: null },
              });
            } catch (error) {
              console.log(`[paseo-dnd] tombstone failed: ${String(error)}`);
            }
          }
          console.log(`[paseo-dnd] state saved + card pinned, tombstoned=${stale.length}`);
        } catch (error) {
          console.log(`[paseo-dnd] state path failed: ${String(error)}`);
        }
      }
      if (compacted) await maybeResync(event.agent.id, handle, "compaction");
      return;
    }

    // --- Drift: known game agent dropped its state line -------------------
    if (knownGames.has(event.agent.id) || (await loadRecord(event.agent.id))) {
      knownGames.add(event.agent.id);
      await maybeResync(
        event.agent.id,
        handle,
        compacted ? "compaction" : "missing state line",
      );
    }
  });

  return () => {};
}
