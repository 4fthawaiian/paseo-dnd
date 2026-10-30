import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

/** Fetch the canonical saved state for an agent — powers the character sheet panel. */
export const getSheetRpc = defineRpc({
  name: "dnd.sheet",
  input: z.object({ agentId: z.string() }),
  output: z.object({
    found: z.boolean(),
    agentId: z.string(),
    state: z.unknown().nullish(),
    turnCount: z.number(),
    createdAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
  }),
});
