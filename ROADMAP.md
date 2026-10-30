# DND.exe — Roadmap

The plugin is the **engine**; the model is pure **improv**. Anything a prompt
can fake (stats, dice, maps, memory) belongs in code. Anything it can't fake
(soul, wit, a wendigo that knows your face) stays with the model.

## Shipped

- **`/dnd [theme] [@provider/model]`** — agent-context slash command. Spawns a
  dedicated game agent: real `systemPrompt` (the DM), inherited provider/model/
  mode/thinking from the spawning session, free-text theme, labeled
  `paseo-dnd=adventure`.
- **State card** — DM emits `⟦STATE⟧{json}`; `agent.turn_ended` parses it and
  appends a `dnd-state` plugin row at the tail. Older cards are tombstoned
  (`state:null`) so exactly one card — always current — rides the bottom of
  the timeline. HP bar, LV/XP/gold chips, status pills, inventory tiles,
  location line.
- **Adventure panel** — agent panel opened on spawn; "Enter the dungeon"
  jump button via `navigation.openAgent` when the host supports it.
- **`/dndprobe`** — debug command: dumps canonical timeline item types +
  marker presence to the panel and `paseo plugin logs`.
- **Narrative transformer** — client-side `assistant_message` transformer that
  strips the `⟦STATE⟧` line into a clean `dnd-turn` row. *Currently inert on
  app 0.13.x (suspected 0.12 SDK ↔ host contract drift); the server-side card
  path works regardless.*

- **Canonical state store** — per-agent JSON under
  `~/.paseo/plugin-settings/paseo-dnd/saves/` (30-turn history), updated
  every marked turn.
- **Real dice** — `⟦ROLL [label:] XdY±Z [vs DC N]⟧` → server RNG → `dnd-roll`
  card (individual rolls, total, DC pass/fail) → auto-sends the outcome back
  so the DM narrates a *real* result instead of picking a dramatic number.
- **Drift recovery** — if a known game agent ends a turn with no state line,
  or a `compaction` item appears, the plugin re-sends a compacted canonical
  state so the model re-syncs instead of hallucinating your inventory back.
- **Table talk** — `[ooc]` / `[DM]` / `((...))` get an answer-only reply: no
  narration, no rolls, no world advancement.
- **Map card** — `⟦MAP⟧` fenced ASCII (≤24×12) → `dnd-map` tile-grid row:
  colored cells, glyph labels, parsed legend chips. One current map, same
  tombstone discipline.
- **Character sheet HUD** — the Adventure panel reads the canonical store
  (`dnd.sheet` RPC, 2.5s poll) and renders a live sheet: name/class/ancestry,
  LV badge, HP + XP bars, AC and six-stat grid with modifiers, status,
  inventory, turn counter. Optional character keys ride inside `⟦STATE⟧`.
  `/dndsheet` opens it.

## Next

- **Saves / resume campaign** — named saves in the store dir;
  `/dnd-save <name>`, `/dnd-resume <name>` spawning a fresh agent with the
  saved state injected into the opening prompt.
- **Manual dice roller** — a sheet-panel button that appends `dnd-roll` rows
  on demand (saves, checks the player calls for).
- **Quest log & NPC memory** — second marker `⟦QUEST⟧`/`⟦NPC⟧` updating
  durable ledgers; surfaced in the HUD and re-injected on drift.
- **Persistent world map** — locations tracked as a graph; a generated
  overland map card complementing the per-scene `⟦MAP⟧` tiles.

## Later / spicy

- **Co-op mode** — Paseo sessions are shared across clients already; formalize
  party members, turn order, per-player state cards.
- **Model split-brain** — cheap model for travel/grind, big model for boss
  fights and NPC-heavy scenes; switchable per turn via labels.
- **Fix or retire the client transformer** once the 0.13 host contract is
  understood (raw `⟦STATE⟧` text visible in messages until then).
