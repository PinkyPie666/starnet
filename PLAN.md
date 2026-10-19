# STARNET build plan

A pixel-art space-station control room where every AI agent is a crew member who
walks to a desk, works while tokens stream, and carries the result to the Outbox.

## Art direction (decided)

Early-90s console look (Phantasy Star / SNES-era sci-fi): 16 px tiles, hard black
outlines, a small fixed palette, no smoothing.

- Base tiles: "Warped Top-Down Tech Lab" by ansimuz (CC0). Its 17-color palette
  (teal floor, violet-grey walls, amber hazard stripes) is the master palette.
- Crew: CC0 "16x16 base sprites" (4 directions, idle + 6 walk frames). Uniforms,
  hair, skin and class trim are painted on at runtime by palette swap, so every
  agent is an original character and recruits can pick their look.
- Everything the packs lack (desks, monitors, pool table, sofa, fish tank,
  conveyor, machines, outbox, summon pad, starfield) is drawn procedurally on
  canvas using only the master palette plus two glow accents (electric blue,
  teal glow), so it reads as one set.
- All sprites are packed into a single runtime atlas texture.

## Architecture (decided)

- Vite + TypeScript, Phaser 3 for the world, plain DOM for panels (no React:
  smaller bundle, panels are simple).
- `core/bus.ts`: typed event bus. `core/store.ts`: app state + persistence
  (IndexedDB via `core/db.ts`).
- `core/scheduler.ts`: pure task scheduler (queue, per-agent busy state,
  concurrency cap, pipeline chaining). Runner is injected, so it is unit-tested
  without network.
- `agents/demo.ts`: scripted streamed text per class. `agents/live.ts`: official
  Anthropic TypeScript SDK in the browser (`dangerouslyAllowBrowser`), loaded
  lazily only when Live mode is used.
- `agents/spend.ts`: daily token guard (input + output tokens, resets at local
  midnight).
- Stream deltas are buffered and flushed to the UI once per animation frame.

## Phases

1. [x] One room (Work Bay), 3 crew, scripted events, A* walking, sit and type.
   Gate: screenshot looks like a real game.
2. [x] Live agents, streaming, Outbox, spend guard, Stop per agent, error states.
   Gate: 4 agents concurrently without jank.
3. [ ] Recruitment Bay, Pipeline mode, Factory + Lounge rooms, mobile layout.
   Gate: Playwright screenshots on desktop and 390 px.
4. [ ] Optimization, tests, README, CREDITS, deploy.
   Gate: live URL works in Demo mode with no key.

## Decisions made on the user's behalf

- Models offered: `claude-haiku-4-5-20251001` (default, as requested),
  `claude-sonnet-5-5` (as requested) and `claude-haiku-5-5` (newer, cheaper).
  Sonnet 5.5 requests opt into server-side refusal fallback (`fallbacks: "default"`).
- Max output per task: 2048 tokens (keeps spend predictable). Daily guard
  default: 200,000 tokens.
- Concurrency cap: 6 agents working at once.
- Panels are plain DOM; UI text is English; agent output can be any language
  (Thai falls back to a system font because the pixel fonts lack Thai glyphs).
