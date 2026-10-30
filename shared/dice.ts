/** Dice spec parsing and real RNG for the ⟦ROLL⟧ marker. */

export const ROLL_MARKER = "⟦ROLL⟧";

export interface RollSpec {
  /** Optional label before the dice spec, e.g. "attack" or "dex save". */
  label: string | null;
  count: number;
  sides: number;
  modifier: number;
  dc: number | null;
}

export interface RollOutcome {
  spec: RollSpec;
  rolls: number[];
  total: number;
  success: boolean | null;
}

/**
 * Parses `⟦ROLL⟧ <body>` where body is `[label:] XdY±Z [vs DC N]`,
 * `[label] XdY±Z ...`, or just `XdY±Z`. Returns null when unparseable.
 */
export function parseRollSpec(body: string): RollSpec | null {
  const m = /(?:(.+?)\s*[:：]\s*)?(\d*)d(\d+)\s*([+-]\s*\d+)?(?:\s*vs\.?\s*dc\.?\s*(\d+))?/i.exec(
    body.trim(),
  );
  if (!m) return null;
  const count = m[2] ? parseInt(m[2], 10) : 1;
  const sides = parseInt(m[3], 10);
  if (!Number.isFinite(count) || !Number.isFinite(sides)) return null;
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
  return {
    label: m[1] ? m[1].trim() : null,
    count,
    sides,
    modifier: m[4] ? parseInt(m[4].replace(/\s/g, ""), 10) : 0,
    dc: m[5] ? parseInt(m[5], 10) : null,
  };
}

export function rollDice(spec: RollSpec): RollOutcome {
  const rolls = Array.from(
    { length: spec.count },
    () => 1 + Math.floor(Math.random() * spec.sides),
  );
  const total = rolls.reduce((a, b) => a + b, 0) + spec.modifier;
  return {
    spec,
    rolls,
    total,
    success: spec.dc != null ? total >= spec.dc : null,
  };
}

/** `1d20+3` → "1d20+3"; with dc → "1d20+3 vs DC 15". */
export function specToString(spec: RollSpec): string {
  const mod =
    spec.modifier > 0 ? `+${spec.modifier}` : spec.modifier < 0 ? `${spec.modifier}` : "";
  const base = `${spec.count}d${spec.sides}${mod}`;
  return spec.dc != null ? `${base} vs DC ${spec.dc}` : base;
}

/** The user-visible resync line the plugin sends back after rolling. */
export function outcomeMessage(outcome: RollOutcome): string {
  const { spec, rolls, total, success } = outcome;
  const label = spec.label ? `${spec.label}: ` : "";
  const mod =
    spec.modifier > 0 ? `+${spec.modifier}` : spec.modifier < 0 ? `${spec.modifier}` : "";
  const verdict =
    success == null ? "" : success ? " — SUCCESS" : " — FAILURE";
  return [
    `[Dice] ${label}${spec.count}d${spec.sides}${mod} → [${rolls.join(", ")}]${mod} = ${total}${spec.dc != null ? ` vs DC ${spec.dc}` : ""}${verdict}.`,
    "Narrate the outcome of this real roll — do not re-roll or contradict it. End with your state line.",
  ].join("\n");
}
