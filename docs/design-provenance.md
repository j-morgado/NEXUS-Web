# Design-system provenance

## Source hierarchy

The current product decisions and canonical NEXUS requirements govern scope and behavior. Within that scope:

1. The supplied NEXUS Figma file and supplied styleframes govern NEXUS-specific visual direction.
2. The approved Leidos design system governs colors, typography, and reusable components.
3. `NEXUS-POC` is behavioral proof-of-concept context only. Its migration styling is not a visual authority and must not override the NEXUS Figma, supplied styleframes, or approved Leidos system.

The supplied `Styleframe Cards.jpeg`, `Styleframe Hero.png`, `Styleframe Menu.png`, and `Styleframe Tabs.png` were materialized from the user's private Library and inspected as actual pixels, along with the supplied NEXUS attract, main-screen, Explorer, and experience-module wireframes. They informed the current card hierarchy, large light-weight display typography, purple/ultraviolet emphasis, spacious kiosk composition, and secondary Explorer/menu treatment.

The connected, read-only Figma workflow was restored and audited on 2026-11-02. The implementation now reconciles the verified Nexus attract (`1388:2487`), selector (`1388:2518`), Explorer (`1395:15557`), Explorer hero (`1395:15561`), feature accordion (`1395:15559`) and email/share (`934:5321`) compositions. Current requirements intentionally supersede the legacy email frame's QR, consent-checkbox, PDF-link and on-screen-keyboard behavior.

The approved Leidos DS typography (`5063:1980`), inverted button (`4945:5777`) and input (`5144:9868`) nodes were also inspected. The current local adapters use the verified 50px pill treatment and 8px-radius, `#A7A3FE`-bordered input treatment in addition to the authentic type assets below. Figma's temporary asset URLs returned HTTP 403 to the build executor, so the already-authorized supplied Nexus hero styleframe is used as the labeled full-bleed attract placeholder. It remains a private ignored build input and must be replaced by the final attract loop when supplied.

The public Leidos Storybook foundations pages were rendered and inspected in Chromium on 2026-11-02. The following values were read from the actual Storybook document styles and are used as local compatibility tokens:

| Token | Verified value |
| --- | --- |
| `--cl-color-base-white` | `#fff` |
| `--cl-color-purple-950` | `#251846` |
| `--cl-color-purple-800` | `#4f2ea5` |
| `--cl-color-ultraviolet-500` | `#f441f3` |
| `--cl-color-ultraviolet-800` | `#8f1588` |

Storybook's rendered typography uses `Avenir Next for Leidos`. Its desktop hierarchy includes H1 thin at 60px/200, H1 light at 56px/300, H2 at 48px/300, H3 at 40px/300, H4 at 32px/300, and body at 18px/400. The NEXUS responsive scale preserves those light heading weights but adapts sizes to kiosk viewports.

Original `Avenir Next for Leidos` binaries were subsequently retrieved from the user's authorized private MHC handoff and integrated into this private development build. They remain excluded from Git and public redistribution/hosting rights are not inferred. Exact archive, hash, weight mapping, and private/runtime locations are recorded in `docs/PRIVATE-FONT-PROVENANCE.md`. The private component package remains unavailable, so controls are local adapters rather than claimed package components.
