# Design-system provenance

## Source hierarchy

The current product decisions and canonical NEXUS requirements govern scope and behavior. Within that scope:

1. The supplied NEXUS Figma file and supplied styleframes govern NEXUS-specific visual direction.
2. The approved Leidos design system governs colors, typography, and reusable components.
3. `NEXUS-POC` is behavioral proof-of-concept context only. Its migration styling is not a visual authority and must not override the NEXUS Figma, supplied styleframes, or approved Leidos system.

The supplied `Styleframe Cards.jpeg`, `Styleframe Hero.png`, `Styleframe Menu.png`, and `Styleframe Tabs.png` were materialized from the user's private Library and inspected as actual pixels, along with the supplied NEXUS attract, main-screen, Explorer, and experience-module wireframes. They informed the current card hierarchy, large light-weight display typography, purple/ultraviolet emphasis, spacious kiosk composition, and secondary Explorer/menu treatment.

The NEXUS Figma link is known, but its frames and metadata remain unavailable through the current authorized connection. Accordingly, this implementation does not claim exact fidelity to unseen Figma frames. It implements the visible supplied references and records the access limitation for later verification.

The public Leidos Storybook foundations pages were rendered and inspected in Chromium on 2026-11-02. The following values were read from the actual Storybook document styles and are used as local compatibility tokens:

| Token | Verified value |
| --- | --- |
| `--cl-color-base-white` | `#fff` |
| `--cl-color-purple-950` | `#251846` |
| `--cl-color-purple-800` | `#4f2ea5` |
| `--cl-color-ultraviolet-500` | `#f441f3` |
| `--cl-color-ultraviolet-800` | `#8f1588` |

Storybook's rendered typography uses `Avenir Next for Leidos`. Its desktop hierarchy includes H1 thin at 60px/200, H1 light at 56px/300, H2 at 48px/300, H3 at 40px/300, H4 at 32px/300, and body at 18px/400. The NEXUS responsive scale preserves those light heading weights but adapts sizes to kiosk viewports.

Original `Avenir Next for Leidos` binaries were subsequently retrieved from the user's authorized private MHC handoff and integrated into this private development build. They remain excluded from Git and public redistribution/hosting rights are not inferred. Exact archive, hash, weight mapping, and private/runtime locations are recorded in `docs/PRIVATE-FONT-PROVENANCE.md`. The private component package and connected Figma frame metadata remain unavailable, so controls are local adapters rather than claimed package components and exact unseen-frame fidelity is not asserted.
