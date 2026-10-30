import type { PluginAgentPanelProps } from "@getpaseo/plugin/client";
import type { PluginTheme } from "@getpaseo/plugin";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { z } from "zod";
import { callRpc } from "./rpc";
import { getSheetRpc } from "../shared/sheet";
import { StateSchema } from "./turn";
import {
  getPendingAdventure,
  getProbeResult,
  subscribePendingAdventure,
} from "./spawn";

type Sheet = z.output<typeof StateSchema>;
type SheetResult = {
  found: boolean;
  state: Sheet;
  turnCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

const STAT_ORDER = ["str", "dex", "con", "int", "wis", "cha"];

function modOf(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function Bar({
  pct,
  color,
  track,
}: {
  pct: number;
  color: string;
  track: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        height: 8,
        borderRadius: 4,
        backgroundColor: track,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${Math.max(0, Math.min(1, pct)) * 100}%`,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function StatTile({
  label,
  score,
  colors,
}: {
  label: string;
  score: number;
  colors: PluginTheme["colors"];
}) {
  return (
    <View
      style={{
        minWidth: 52,
        flexGrow: 1,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 6,
        alignItems: "center",
        gap: 1,
      }}
    >
      <Text style={{ color: colors.foregroundMuted, fontSize: 10, fontWeight: "700" }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800" }}>
        {score}
      </Text>
      <Text style={{ color: colors.foregroundMuted, fontSize: 10 }}>{modOf(score)}</Text>
    </View>
  );
}

function CharacterSheet({
  sheet,
  colors,
}: {
  sheet: SheetResult;
  colors: PluginTheme["colors"];
}) {
  const s = sheet.state;
  if (!s) return null;
  const hpPct = s.hp != null && s.maxHp ? s.hp / s.maxHp : null;
  const xpPct = s.xp != null && s.xpToNext ? s.xp / s.xpToNext : null;
  const statKeys = s.stats
    ? [
        ...STAT_ORDER.filter((k) =>
          Object.keys(s.stats!).some((x) => x.toLowerCase() === k),
        ).map(
          (k) => Object.keys(s.stats!).find((x) => x.toLowerCase() === k)!,
        ),
        ...Object.keys(s.stats)
          .filter((k) => !STAT_ORDER.includes(k.toLowerCase()))
          .sort(),
      ]
    : [];
  const title = [s.class, s.ancestry].filter(Boolean).join(" · ");

  return (
    <View
      style={{
        backgroundColor: colors.surface1,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "800" }}>
            {s.name ?? "Unnamed hero"}
          </Text>
          {s.level != null && (
            <View
              style={{
                backgroundColor: colors.accent,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Text style={{ color: colors.surface0, fontSize: 11, fontWeight: "800" }}>
                LV {s.level}
              </Text>
            </View>
          )}
        </View>
        {title ? (
          <Text style={{ color: colors.foregroundMuted, fontSize: 13 }}>{title}</Text>
        ) : null}
        {s.location ? (
          <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>
            ◆ {s.location}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.statusDanger, fontSize: 13, fontWeight: "700" }}>♥</Text>
          <Bar pct={hpPct ?? 0} color={colors.statusDanger} track={colors.surface2} />
          <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700" }}>
            {s.hp ?? "—"}
            {s.maxHp != null ? `/${s.maxHp}` : ""}
          </Text>
        </View>
        {xpPct != null && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: colors.statusWarning, fontSize: 13, fontWeight: "700" }}>XP</Text>
            <Bar pct={xpPct} color={colors.statusWarning} track={colors.surface2} />
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700" }}>
              {s.xp}/{s.xpToNext}
            </Text>
          </View>
        )}
      </View>

      {(s.ac != null || statKeys.length > 0 || s.gold != null) && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {s.ac != null && (
            <View
              style={{
                minWidth: 52,
                flexGrow: 1,
                backgroundColor: colors.surface2,
                borderRadius: 8,
                paddingVertical: 6,
                alignItems: "center",
                gap: 1,
              }}
            >
              <Text style={{ color: colors.foregroundMuted, fontSize: 10, fontWeight: "700" }}>AC</Text>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800" }}>{s.ac}</Text>
            </View>
          )}
          {statKeys.map((k) => (
            <StatTile key={k} label={k} score={s.stats![k]} colors={colors} />
          ))}
          {s.gold != null && (
            <View
              style={{
                minWidth: 52,
                flexGrow: 1,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 8,
                paddingVertical: 6,
                alignItems: "center",
                gap: 1,
              }}
            >
              <Text style={{ color: colors.foregroundMuted, fontSize: 10, fontWeight: "700" }}>GOLD</Text>
              <Text style={{ color: colors.statusWarning, fontSize: 16, fontWeight: "800" }}>
                ◈ {s.gold}
              </Text>
            </View>
          )}
        </View>
      )}

      {s.status && s.status.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {s.status.map((st) => (
            <View
              key={st}
              style={{
                backgroundColor: colors.surface2,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 3,
              }}
            >
              <Text style={{ color: colors.foreground, fontSize: 12 }}>{st}</Text>
            </View>
          ))}
        </View>
      )}

      {s.inventory && s.inventory.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.foregroundMuted, fontSize: 11, fontWeight: "700" }}>
            INVENTORY
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {s.inventory.map((i) => (
              <View
                key={i}
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
        </View>
      )}

      <Text style={{ color: colors.foregroundMuted, fontSize: 11 }}>
        turn {sheet.turnCount}
        {sheet.createdAt ? ` · since ${sheet.createdAt.slice(0, 10)}` : ""}
      </Text>
    </View>
  );
}

export function AdventurePanel({ theme, layout, navigation, params }: PluginAgentPanelProps) {
  const pending = useSyncExternalStore(
    subscribePendingAdventure,
    getPendingAdventure,
  );
  const probe = useSyncExternalStore(subscribePendingAdventure, getProbeResult);
  const colors = theme.colors;
  const accent = colors.accent;
  const pad = layout.compact ? 16 : 24;
  const agentId = params?.agentId;
  const [sheet, setSheet] = useState<SheetResult | null>(null);

  useEffect(() => {
    if (!agentId) return;
    let live = true;
    const tick = async () => {
      try {
        const r = await callRpc(getSheetRpc, { agentId });
        if (live) {
          setSheet(
            r.found
              ? {
                  found: true,
                  state: StateSchema.parse(r.state) ?? null,
                  turnCount: r.turnCount,
                  createdAt: r.createdAt ?? null,
                  updatedAt: r.updatedAt ?? null,
                }
              : { found: false, state: null, turnCount: 0, createdAt: null, updatedAt: null },
          );
        }
      } catch {
        if (live) setSheet(null);
      }
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [agentId]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface0 }}
      contentContainerStyle={{ padding: pad, gap: 16 }}
    >
      {sheet?.found && <CharacterSheet sheet={sheet} colors={colors} />}

      {!pending && !sheet?.found && (
        <View>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600" }}>
            No adventure yet
          </Text>
          <Text style={{ color: colors.foregroundMuted, marginTop: 8, lineHeight: 20 }}>
            Type /dnd in any agent session's composer to roll up a dungeon. Add a
            theme — "/dnd gothic vampire soap opera" — or "@provider/model" to
            pick a different brain.
          </Text>
        </View>
      )}

      {pending && !pending.ok && (
        <View>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600" }}>
            The portal fizzled
          </Text>
          <Text style={{ color: colors.foregroundMuted, marginTop: 8, lineHeight: 20 }}>
            {pending.error}
          </Text>
        </View>
      )}

      {pending?.ok && (
        <View
          style={{
            backgroundColor: colors.surface1,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 14,
            padding: 20,
            gap: 12,
          }}
        >
          <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>
            {pending.title}
          </Text>
          <Text style={{ color: colors.foregroundMuted, lineHeight: 20 }}>
            {pending.theme
              ? `Theme: ${pending.theme}`
              : "Classic heroic fantasy"}
            {"\n"}Running on {pending.providerModel}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enter the dungeon"
            disabled={!navigation?.openAgent}
            onPress={() =>
              pending.agentId && navigation?.openAgent({ agentId: pending.agentId })
            }
            style={{
              backgroundColor: accent,
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: "center",
              opacity: navigation?.openAgent ? 1 : 0.5,
            }}
          >
            <Text style={{ color: colors.surface0, fontWeight: "700", fontSize: 15 }}>
              Enter the dungeon
            </Text>
          </Pressable>
          {!navigation?.openAgent && (
            <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>
              This host can't jump you there — open “{pending.title}” from the agent
              list instead.
            </Text>
          )}
        </View>
      )}

      {probe && (
        <View
          style={{
            backgroundColor: colors.surface1,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 14,
            padding: 20,
            gap: 8,
          }}
        >
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600" }}>
            Timeline probe
          </Text>
          {probe.error ? (
            <Text style={{ color: colors.statusDanger }}>{probe.error}</Text>
          ) : null}
          {probe.items.map((item, idx) => (
            <View key={idx} style={{ gap: 2 }}>
              <Text style={{ color: colors.foreground, fontSize: 13 }}>
                {item.type}
                {item.hasMarker ? "  ⟦MARKER⟧" : ""}  · {item.len} chars
              </Text>
              {item.preview ? (
                <Text
                  style={{ color: colors.foregroundMuted, fontSize: 11 }}
                  numberOfLines={2}
                >
                  …{item.preview}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
