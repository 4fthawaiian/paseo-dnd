# DND.exe

DND.exe turns any Paseo agent session into a dedicated text adventure. Type
`/dnd` in the composer and it spawns a fresh agent whose system prompt is a
Dungeon Master, inheriting the provider and model of the session it launched
from. Add a free-text theme (`/dnd gothic vampire soap opera`) or an explicit
model (`/dnd @provider/model`).

The plugin is the game engine; the model only narrates. A daemon-side hook
parses each turn, so state lives in code instead of the model's memory:

- A state card (HP, level, XP, gold, status effects, inventory, location) is
  pinned under the newest DM reply — one card, always current.
- Real dice: the DM requests a roll, the daemon rolls actual RNG, shows a dice
  card, and reports the outcome back so the model narrates a result it did not
  choose.
- An optional ASCII map block renders as a monospace map card with per-glyph
  coloring.
- Canonical state is persisted per agent and re-synced to the model if a turn
  drops its state line or the session is compacted.

## Setup

No accounts, tokens, or settings. The game agent runs on whichever
provider/model the session already uses. Paseo 0.12.0 or later.

## Data

Prompts and game text go to your configured agent provider, same as any
session. Per-agent game state is stored as JSON on the daemon host under
`~/.paseo/plugin-settings/paseo-dnd/saves/`. Nothing is sent anywhere else.
