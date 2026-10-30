import type { PluginClientContext } from "@getpaseo/plugin/client";
import { AdventurePanel } from "./client/panel";
import { setProbeResult, spawnAdventure } from "./client/spawn";
import {
  CardSchema,
  DndTurn,
  MapCardRow,
  MapSchema,
  RollCardRow,
  RollSchema,
  StateCardRow,
  TurnSchema,
  transformDndTurn,
} from "./client/turn";
import { inspectTimelineRpc } from "./shared/inspect";
import { setRpc } from "./client/rpc";

export default function contribute(client: PluginClientContext) {
  setRpc(client.rpc.bind(client));
  client.addSlashCommand({
    name: "dnd",
    description: "Roll up a text adventure in a fresh agent session",
    argumentHint: "[theme] · @provider/model to pick a brain",
    context: "agent",
    async onSubmit(ctx) {
      await spawnAdventure(ctx);
    },
  });

  client.addSlashCommand({
    name: "dndprobe",
    description: "Debug: dump this session's timeline item types",
    argumentHint: "",
    context: "agent",
    async onSubmit(ctx) {
      try {
        const res = await ctx.rpc(inspectTimelineRpc, {
          agentId: ctx.agent.id,
        });
        setProbeResult({ items: res.items });
      } catch (error) {
        setProbeResult({
          items: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }
      ctx.openPanel("adventure");
    },
  });

  client.addSlashCommand({
    name: "dndsheet",
    description: "Open your character sheet",
    argumentHint: "",
    context: "agent",
    async onSubmit(ctx) {
      ctx.openPanel("adventure");
    },
  });

  client.addWorkspacePanel({
    id: "adventure",
    title: "Adventure",
    icon: "Dices",
    context: "agent",
    Component: AdventurePanel,
  });

  client.addTimelineTransformer({
    id: "dnd-turn",
    query: { itemType: "assistant_message" },
    transform({ item, phase }) {
      return transformDndTurn(item, phase);
    },
  });

  client.addTimelineRenderer({
    kind: "dnd-turn",
    version: 1,
    schema: TurnSchema,
    Component: DndTurn,
  });

  client.addTimelineRenderer({
    kind: "dnd-state",
    version: 1,
    schema: CardSchema,
    Component: StateCardRow,
  });

  client.addTimelineRenderer({
    kind: "dnd-roll",
    version: 1,
    schema: RollSchema,
    Component: RollCardRow,
  });

  client.addTimelineRenderer({
    kind: "dnd-map",
    version: 1,
    schema: MapSchema,
    Component: MapCardRow,
  });

  return () => {};
}
