# Credits

STARNET's code is MIT licensed (see `LICENSE`). Every third-party asset below
was checked by hand on its source page before use. `scripts/fetch-assets.sh`
downloads the art from these exact URLs.

## Art

| Asset | Author | Source | License | Used for |
|---|---|---|---|---|
| Warped Top-Down Tech Lab (`lab-tileset.png`) | Luis Zuno ([ansimuz](https://opengameart.org/users/ansimuz)) | https://opengameart.org/content/warped-top-down-tech-lab | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the bundled `public-license.txt` also allows redistribution; credit not required but appreciated) | Floors, walls, wall consoles, doors, hazard stripes, vents. Its 17-color palette is the master palette for all procedural art. |
| 16x16 base sprites (`crew-base-a.png`, `crew-base-b.png`) | "Unnamed" (as listed on OpenGameArt) | https://opengameart.org/content/16x16-base-sprites | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), no attribution required | Body shapes and 4-direction walk cycles. Uniforms, hair, skin and class colors are painted on at runtime, so every crew member is an original character. |

## Original art made for STARNET (MIT, part of this repo)

Drawn procedurally on canvas in `src/game/atlas.ts` and `src/game/crewArt.ts`,
using only the Tech Lab palette plus a few accent colors: desks and monitors,
office chairs, ops consoles, factory stations, the conveyor belt, data crates,
the Outbox chute, the summon pad and holo terminals, pool table, sofas, fish
tank and fish, coffee machine, hydroponic plants, server racks, carpet, the
3x5 pixel font used for in-world labels, and the parallax starfield.

## Fonts (self-hosted through Fontsource)

| Font | Author | Package | License |
|---|---|---|---|
| Press Start 2P | CodeMan38 | `@fontsource/press-start-2p` | SIL Open Font License 1.1 |
| VT323 | Peter Hull | `@fontsource/vt323` | SIL Open Font License 1.1 |
| Chakra Petch (Thai text) | Cadson Demak | `@fontsource/chakra-petch` | SIL Open Font License 1.1 |

## Icons

[Lucide](https://lucide.dev) icons (`lucide` package), ISC License.

## Libraries

| Library | License |
|---|---|
| [Phaser 3](https://phaser.io) | MIT |
| [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) | MIT |
| Vite, TypeScript, Vitest, Playwright (dev only) | MIT / Apache-2.0 |

No paid or non-redistributable packs are used, and no character depicts an
existing franchise.
