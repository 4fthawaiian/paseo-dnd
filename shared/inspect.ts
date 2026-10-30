import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const inspectTimelineRpc = defineRpc({
  name: "dnd.inspect",
  input: z.object({ agentId: z.string() }),
  output: z.object({
    items: z.array(
      z.object({
        type: z.string(),
        hasMarker: z.boolean(),
        len: z.number(),
        preview: z.string(),
      }),
    ),
  }),
});
