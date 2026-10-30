import type { PluginTheme } from "@getpaseo/plugin";
import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import type { JsonValue } from "@getpaseo/protocol/agent-types";
import { Platform, Text, View } from "react-native";
import { z } from "zod";
import { STATE_MARKER } from "../shared/dnd";

const NumOrNull = z.coerce.number().nullish().catch(null);
const StrList = z.array(z.string()).nullish().catch(null);

const StateSchema = z
  .object({
    hp: NumOrNull,
    maxHp: NumOrNull,
    level: NumOrNull,
    xp: NumOrNull,
    gold: NumOrNull,
    location: z.string().nullish().catch(null),
    inventory: StrList,
    status: StrList,
  })
  .nullish()
  .catch(null);

export const TurnSchema = z.object({
  text: z.string().catch(""),
  phase: z.enum(["streaming", "complete"]).nullish().catch(null),
});

/** Schema for daemon-appended `dnd-state` card rows. */
export const CardSchema = z.object({
  state: StateSchema,
});

/** Schema for daemon-appended `dnd-map` ASCII map rows. */
export const MapSchema = z.object({
  title: z.string().nullish().catch(null),
  grid: z.array(z.string()).catch([]),
});

/** Schema for daemon-appended `dnd-roll` dice cards. */
export const RollSchema = z.object({
  label: z.string().nullish().catch(null),
  spec: z.string().catch(""),
  rolls: z.array(z.coerce.number()).catch([]),
  total: z.coerce.number().nullish().catch(null),
  dc: z.coerce.number().nullish().catch(null),
  success: z.boolean().nullish().catch(null),
});

type GameState = z.output<typeof StateSchema>;

/** Extract narrative + state from a DM message, or null if it's not a DM turn. */
export function splitTurn(
  text: string,
): { text: string; state: JsonValue | null } | null {
  const idx = text.indexOf(STATE_MARKER);
  if (idx === -1) return null;
  const narrative = text.slice(0, idx).trimEnd();
  const raw = text.slice(idx + STATE_MARKER.length).trim();
  let state: JsonValue | null = null;
  try {
    state = JSON.parse(raw);
  } catch {
    const end = raw.lastIndexOf("}");
    if (end > 0) {
      try {
        state = JSON.parse(raw.slice(0, end + 1));
      } catch {
        // partial JSON while streaming — card shows up when it completes
      }
    }
  }
  return { text: narrative, state };
}

function Chip({ label, colors }: { label: string; colors: PluginTheme["colors"] }) {
  return (
    <View
      style={{
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function StateCard({ state, theme }: { state: NonNullable<GameState>; theme: PluginTheme }) {
  const colors = theme.colors;
  const hp = state.hp ?? null;
  const maxHp = state.maxHp ?? null;
  const pct = hp != null && maxHp ? Math.max(0, Math.min(1, hp / maxHp)) : null;
  const hpColor = colors.statusDanger;
  const chips: string[] = [];
  if (state.level != null) chips.push(`LV ${state.level}`);
  if (state.xp != null) chips.push(`XP ${state.xp}`);
  if (state.gold != null) chips.push(`◈ ${state.gold}`);

  return (
    <View
      style={{
        marginTop: 10,
        backgroundColor: colors.surface1,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        gap: 10,
      }}
    >
      {state.location ? (
        <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>
          ◆ {state.location}
        </Text>
      ) : null}

      {hp != null ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: hpColor, fontSize: 13, fontWeight: "700" }}>♥</Text>
          <View
            style={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.surface2,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${(pct ?? 0) * 100}%`,
                height: 8,
                borderRadius: 4,
                backgroundColor: hpColor,
              }}
            />
          </View>
          <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600" }}>
            {hp}
            {maxHp != null ? `/${maxHp}` : ""}
          </Text>
        </View>
      ) : null}

      {chips.length > 0 || (state.status && state.status.length > 0) ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {chips.map((c) => (
            <Chip key={c} label={c} colors={colors} />
          ))}
          {state.status?.map((s) => (
            <View
              key={`s-${s}`}
              style={{
                backgroundColor: colors.surface2,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 3,
              }}
            >
              <Text style={{ color: colors.foreground, fontSize: 12 }}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {state.inventory && state.inventory.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {state.inventory.map((i) => (
            <View
              key={`i-${i}`}
              style={{
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>{i}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function StateCardRow({ item, theme }: PluginTimelineItemProps<z.output<typeof CardSchema>>) {
  return item.data.state ? <StateCard state={item.data.state} theme={theme} /> : null;
}

const MONO_FONT = Platform.OS === "ios" ? "Menlo" : "monospace";

function mapCharColor(ch: string, colors: PluginTheme["colors"]): string {
  if (ch === "@" || ch === "P") return colors.accent;
  if ("#█▓|_=-".includes(ch)) return colors.foregroundMuted;
  if ("<>^v+✚*$!".includes(ch)) return colors.statusSuccess;
  if ("~".includes(ch)) return colors.statusWarning;
  if (/[0-9]/.test(ch)) return colors.statusWarning;
  if (/[A-Z]/.test(ch)) return colors.statusDanger;
  return colors.foreground;
}

export function MapCardRow({ item, theme }: PluginTimelineItemProps<z.output<typeof MapSchema>>) {
  const colors = theme.colors;
  const { title, grid } = item.data;
  if (!grid.length) return null;
  return (
    <View
      style={{
        marginTop: 10,
        backgroundColor: colors.surface1,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        gap: 8,
      }}
    >
      {title ? (
        <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>◆ {title}</Text>
      ) : null}
      <View style={{ alignSelf: "flex-start" }}>
        {grid.map((row, i) => (
          <Text
            key={i}
            style={{
              fontFamily: MONO_FONT,
              fontSize: 13,
              lineHeight: 15,
              letterSpacing: 1,
            }}
          >
            {[...row].map((ch, j) => (
              <Text key={j} style={{ color: mapCharColor(ch, colors) }}>
                {ch === " " ? " " : ch}
              </Text>
            ))}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function RollCardRow({ item, theme }: PluginTimelineItemProps<z.output<typeof RollSchema>>) {
  const colors = theme.colors;
  const { label, spec, rolls, total, dc, success } = item.data;
  const verdict =
    success == null ? null : success ? "SUCCESS" : "FAILURE";
  const verdictColor =
    success == null ? colors.foregroundMuted : success ? colors.statusSuccess : colors.statusDanger;
  return (
    <View
      style={{
        marginTop: 10,
        backgroundColor: colors.surface1,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>
          ⚄ {label ? `${label} — ` : ""}{spec || "roll"}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        {rolls.map((r, i) => (
          <View
            key={i}
            style={{
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 6,
              minWidth: 28,
              paddingVertical: 4,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>{r}</Text>
          </View>
        ))}
        {total != null ? (
          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>
            = {total}
          </Text>
        ) : null}
        {verdict ? (
          <View
            style={{
              borderColor: verdictColor,
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: verdictColor, fontSize: 12, fontWeight: "700" }}>
              {verdict}
            </Text>
          </View>
        ) : null}
      </View>
      {dc != null ? (
        <Text style={{ color: colors.foregroundMuted, fontSize: 11 }}>vs DC {dc} — real dice, no take-backs</Text>
      ) : null}
    </View>
  );
}

export function DndTurn({ item, theme }: PluginTimelineItemProps<z.output<typeof TurnSchema>>) {
  return item.data.text ? (
    <Text
      style={{
        color: theme.colors.foreground,
        fontSize: 15,
        lineHeight: 22,
      }}
    >
      {item.data.text}
    </Text>
  ) : null;
}

export function transformDndTurn(item: { text: string }, phase: "streaming" | "complete") {
  const split = splitTurn(item.text);
  if (!split) return undefined;
  return {
    items: [
      {
        type: "plugin" as const,
        kind: "dnd-turn",
        version: 1,
        data: { text: split.text, phase },
      },
    ],
  };
}
