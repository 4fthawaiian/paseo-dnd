# DND.exe

A text-adventure plugin for [Paseo](https://paseo.sh). Type `/dnd` in any agent
session's composer and it rolls up a dedicated adventure: a fresh agent whose
real system prompt is a Dungeon Master, running on whatever provider/model the
session it spawned from was using.

```
/dnd                              classic heroic fantasy
/dnd gothic vampire soap opera    any theme you can type
/dnd @devin/swe-2-high neon heist pick a different brain first
```

![State card and ASCII map in a live session](assets/screenshot.png)

## The pitch

Asking a model to "run a text adventure" works — for a while. Then it forgets
your inventory, fudges every dice roll into whatever's dramatic, and the whole
world state evaporates when the session gets compacted.

DND.exe splits the job: **the plugin is the engine, the model is the improv.**

- **The model** narrates, plays NPCs, and adjudicates fiction — what it's
  actually good at.
- **The plugin** owns the things models fake badly: canonical state, real RNG,
  persistence, and game UI that isn't text.

## What it does today

- **`/dnd` spawns a dedicated game agent** — clean session, real system
  prompt, tools discouraged, labeled `paseo-dnd=adventure`.
- **State card in the timeline** — the DM ends every reply with a hidden
  `⟦STATE⟧{json}` line; the daemon-side plugin parses it and pins a card
  (HP bar, level/XP/gold, status effects, inventory, location) after each
  turn. Exactly one card, always current, always at the bottom.
- **Canonical state store** — every parsed state snapshot is persisted per
  agent, so the game's truth lives outside the context window.
- **Real dice** — the DM asks for a roll (`⟦ROLL 1d20+3 vs DC 15⟧`), the
  plugin rolls actual RNG, drops a dice card in the timeline, and reports the
  outcome back so the model narrates a result it didn't choose.
- **Drift recovery** — miss a state line or hit session compaction and the
  plugin re-syncs the DM with the canonical state.

See [ROADMAP.md](ROADMAP.md) for where it's going (HUD panel, saves, minimap,
co-op).

## Install

```bash
paseo plugin add https://github.com/bem/paseo-dnd
# or from a local checkout:
paseo plugin add /path/to/paseo-dnd
```

Local directory source; `index.server.ts` runs beside the daemon,
`index.client.tsx` in every connected app. Requirements: Paseo >= 0.12.

## Layout

```
index.client.tsx   slash commands, timeline renderers, panels
index.server.ts    turn_ended engine: state cards, dice, store, drift recovery
shared/dnd.ts      DM system prompt + marker contracts
shared/dice.ts     dice spec parsing + RNG
shared/inspect.ts  /dndprobe RPC contract
client/            spawn logic, Adventure panel, timeline card components
server/            (contract files live in shared/)
```

## Known wart

The client-side timeline transformer that would hide the raw `⟦STATE⟧` text
is inert on the current app host, so the marker shows in messages for now.
The card path is server-side and unaffected.
