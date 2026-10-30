import type { PluginAgentCommandContext } from "@getpaseo/plugin/client";
import { dmSystemPrompt, openingPrompt, parseDndArgs } from "../shared/dnd";

export interface PendingAdventure {
  ok: boolean;
  agentId?: string;
  title?: string;
  theme?: string | null;
  providerModel?: string;
  error?: string;
}

export interface ProbeItem {
  type: string;
  hasMarker: boolean;
  len: number;
  preview: string;
}

export interface ProbeResult {
  items: ProbeItem[];
  error?: string;
}

let pending: PendingAdventure | null = null;
let probe: ProbeResult | null = null;
const listeners = new Set<() => void>();

export function getPendingAdventure(): PendingAdventure | null {
  return pending;
}

export function getProbeResult(): ProbeResult | null {
  return probe;
}

export function subscribePendingAdventure(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}

function setPending(value: PendingAdventure): void {
  pending = value;
  notify();
}

export function setProbeResult(value: ProbeResult): void {
  probe = value;
  notify();
}

function shortTheme(theme: string | null): string {
  if (!theme) return "Dungeon";
  return theme.length > 24 ? `${theme.slice(0, 24)}…` : theme;
}

export async function spawnAdventure(
  ctx: PluginAgentCommandContext & { args: string },
): Promise<void> {
  const { paseo, agent, args } = ctx;
  const parsed = parseDndArgs(args);
  const providerModel =
    parsed.providerModel ??
    (agent.model ? `${agent.provider}/${agent.model}` : agent.provider);
  const title = `⚔ ${shortTheme(parsed.theme)}`;

  try {
    const handle = await paseo.agents.create({
      config: {
        provider: providerModel,
        modeId: agent.currentModeId ?? undefined,
        thinkingOptionId: agent.thinkingOptionId ?? undefined,
        systemPrompt: dmSystemPrompt(parsed.theme),
      },
      cwd: agent.cwd,
      title,
      prompt: openingPrompt(parsed.theme),
      labels: { "paseo-dnd": "adventure" },
    });
    setPending({
      ok: true,
      agentId: handle.id,
      title,
      theme: parsed.theme,
      providerModel,
    });
  } catch (error) {
    setPending({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  ctx.openPanel("adventure");
}
