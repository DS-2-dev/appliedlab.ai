# Site style rules

The public site's look for the redesign, taken from openwebui.com
(checked 2026-09-16 against its live HTML and CSS). No purple and no other
accent for now: black, white and grays only. The tokens are in
`design/tokens.css`. Projectum and the sign-in screens are not covered here.

## Fonts

| Role | Face | Notes |
|---|---|---|
| Display: nav, hero | **Archivo** (variable, 100–900) | SIL OFL. Load with `next/font/google`. openwebui uses it only on the nav and hero. |
| Everything else | System stack | `-apple-system, ui-sans-serif, system-ui, Inter, "Segoe UI", Roboto, Ubuntu, Cantarell, "Noto Sans", sans-serif, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"` |
| Mono | System mono | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` |

- Weights are light. Headings and lead text are 300, body is 300–400, and
  medium (500) is only for eyebrows and the active tab. Never bold.
- Headings are tracked tight (-0.025em).

## Type scale

Breakpoints are Tailwind's defaults: sm 40rem, md 48rem, lg 64rem, xl 80rem.

| Element | Size | Line height | Style |
|---|---|---|---|
| h1 | 1.5rem, 2.25rem from lg | 1.15 | 300, -0.025em, max width 48rem |
| h2 / h3 | 1.25rem, 1.5rem from lg | 1.25 | 300, -0.025em |
| Section heading | 1.5rem, 1.875rem from lg | 1.2 | 300, -0.025em |
| Lead | 1.125rem, 1.25rem from sm, 1.375rem from lg | 1.55 | 300, -0.025em, `text-wrap: balance` |
| Body | 0.875rem, 1rem from lg | 1.625 | 300, 60% opacity, max width 36rem |
| Eyebrow | 11px | 1 | 500, 0.18em, uppercase, 35% opacity |
| Nav, links, buttons | 0.875rem | 1.25 | 400 |
| Tabs | 13px | 1.25 | active 500 at full opacity, inactive 400 at 40% |
| Stat number | 1.875rem, 2.25rem from lg | 1 | 300, -0.025em |

## Color

Light is the default. Dark mode swaps the values.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--page` | `#ffffff` | `#000000` | page background |
| `--surface` | `#fafafa` | `#0a0a0a` | sections, footer, scrolled nav |
| `--ink` | `#1a1a1a` | `#fafafa` | text |
| `--wash` | black 5% | white 10% | behind images, quiet buttons |
| `--wash-hover` | black 10% | white 15% | hover on a wash |
| `--line` | black 8% | white 8% | dividers, card top borders |
| `--line-strong` | black 10% | white 10% | tab rails |
| `--underline` | black 20% | white 20% | text-link underline |

- **Muted text is ink at lower opacity**, never a separate gray: 70%, 60%
  (body), 50% (captions), 40% (inactive), 35% (eyebrows).
- The gray ramp in `tokens.css` is for the rare case that needs a solid
  gray (a placeholder block, say).
- No accent color. A status badge, if one is ever needed, is the only
  exception: `green-500` at 20% with `green-700` text, radius 0.25rem.

## Layout

- Containers run full width. Text blocks cap at 36rem, 42rem or 48rem.
- Side gutters are 20–24px on mobile and 60px from lg.
- Sections are spaced 96px top and bottom.
  - Hero: 128px on top (160px from lg) and 32–40px below.
  - Footer: 64px top and bottom (80px from lg).
- Grids:
  - Feature split: 12 columns from lg, 7 + 5, gap 40px (32px from lg).
  - Card grids: 2 columns from sm and 4 from lg (32px across, 40px down), or 3 columns from md with a 32px gap.
  - Two equal halves: gap 20px.

## Components

- **Buttons are round** (`rounded-full`, ChatGPT-style): the header's Log in
  and Sign up (32px tall), the hero's primary button (44px), the nav link
  pills, the logo, and the How it works cards (24px). A badge is 0.25rem.
  Everything else is square.
- **No shadows.**
- **Primary button:** black fill, white text, round, 14px text, 44px tall with 24px side padding, at least 192px wide.
  - The label sits at the left and an arrow at the right (`justify-between`).
  - Hover: black at 85%. Dark mode inverts the colors.
- **Secondary action:** a text link with a 1px underline at 20% and 4px of space under the text; the underline goes to 60% on hover. Alternatively, text at 60% with a trailing arrow that moves 2px right on hover.
- **Quiet button** (e.g. log in): `--wash` fill, 10px × 4px padding, square corners, `--wash-hover` on hover.
- **Header:** at the top of the page, a see-through bar, 18px × 14px padding, about 60px tall, with the name at the left and the links and account buttons at the right.
  - The moment the page scrolls, it morphs (a spring) into a frosted glass pill (white at 62% over a 20px blur, thin light edge) in the top centre, 44px tall and 12px from the top, like the iPhone's Dynamic Island: the logo, three links at 65% ink, and a menu button.
  - The menu button opens the pill into a 22rem panel with a 28px radius, holding every link and the account buttons.
- **Cards:** no border, radius or shadow.
  - Image card: 16:10 image on `--wash`, zooming to 105% on hover over 500ms; title at 1.25rem, supporting text at 50% below it.
  - Link card: a 1px `--line` top border with 24px above the content; the border goes to 30% ink on hover.
- **Tabs:** a 1px `--line-strong` rail underneath; the active tab gets a 2px underline in the current color.

## Motion

- Default transition: 150ms `cubic-bezier(0.4, 0, 0.2, 1)`. Use 300ms for the nav and 500ms for image zoom.
- Hover is mostly opacity (60% → 100%), plus the 2px arrow nudge.
- Honour `prefers-reduced-motion`: drop the transforms and keep the opacity changes.

## The star

The home page's mark is the six-point star, `public/star.svg`, in black on
the white page. `GooeyFilter` and `PixelOval` stay in the project for later
use.
