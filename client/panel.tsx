import type { PluginAgentPanelProps } from "@getpaseo/plugin/client";
import { useSyncExternalStore } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  getPendingAdventure,
  getProbeResult,
  subscribePendingAdventure,
} from "./spawn";

export function AdventurePanel({ theme, layout, navigation }: PluginAgentPanelProps) {
  const pending = useSyncExternalStore(
    subscribePendingAdventure,
    getPendingAdventure,
  );
  const probe = useSyncExternalStore(subscribePendingAdventure, getProbeResult);
  const colors = theme.colors;
  const accent = colors.accent;
  const pad = layout.compact ? 16 : 24;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface0 }}
      contentContainerStyle={{ padding: pad, gap: 16 }}
    >
      {!pending && (
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
