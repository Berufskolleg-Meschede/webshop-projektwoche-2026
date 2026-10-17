Scope: foundational layer only (borders, shadows, radii, spacing, core colors). No components or mascot assets.

## Borders

- Width: **2px solid**
- Color: ink — `#202860` (light), `#3a4478` (dark)
- Used on StickerCard, PillButton, Chip

## Shadows ("sticker" style)

Hard offset, **no blur**, colored with `var(--BKM_WebShop-shadow-color)` (ink in light mode, black in dark mode — a light ink shadow glares on dark surfaces).

| Token                 | Value                              |
| --------------------- | ---------------------------------- |
| `offsetInkPress`      | `1px 2px 0 var(--BKM_WebShop-ink)` |
| `offsetInkSm`         | `2px 3px 0 var(--BKM_WebShop-ink)` |
| `offsetInk` (default) | `2px 4px 0 var(--BKM_WebShop-ink)` |
| `offsetInkHover`      | `3px 4px 0 var(--BKM_WebShop-ink)` |
| `offsetInkMd`         | `3px 5px 0 var(--BKM_WebShop-ink)` |
| `offsetInkLg`         | `3px 6px 0 var(--BKM_WebShop-ink)` |
| `offsetInkMdHover`    | `4px 7px 0 var(--BKM_WebShop-ink)` |
| `none`                | `none`                             |

React Native: `shadowOpacity: 1`, `shadowRadius: 0`, `elevation = dy`.

## Radii

| Token  | px   |
| ------ | ---- |
| `none` | 0    |
| `sm`   | 4    |
| `md`   | 8    |
| `lg`   | 12   |
| `xl`   | 16   |
| `full` | 9999 |

- Cards (StickerCard): `lg` (12)
- Pill buttons: `full`
- Nesting rule: inner radius = outer radius − padding (never below 0)
- Focus/selection ring radius = inner radius + gap
- CSS form: `calc(var(--BKM_WebShop-radius-lg) - var(--BKM_WebShop-space-sm))`

## Spacing

| Token  | px  |
| ------ | --- |
| `none` | 0   |
| `xxs`  | 2   |
| `xs`   | 4   |
| `sm`   | 8   |
| `md`   | 12  |
| `lg`   | 16  |
| `xl`   | 20  |
| `xxl`  | 24  |
| `xxxl` | 32  |
| `huge` | 48  |

## Core colors

| Token             | Light                   | Dark                  |
| ----------------- | ----------------------- | --------------------- |
| `bg`              | `#f4f6fb`               | `#12141f`             |
| `cardBg`          | `#ffffff`               | `#1b1e2e`             |
| `ink`             | `#202860`               | `#e8eaf2`             |
| `inkMuted`        | `#506898`               | `#9aa3bd`             |
| `border`          | `#202860`               | `#343a58`             |
| `headerBg`        | `#f4f6fb`               | `#171a28`             |
| `tabBarBg`        | `#f8f9fd`               | `#171a28`             |
| `tabBarBorder`    | `#d9deec`               | `#272c45`             |
| `inputBg`         | `#ffffff`               | `#1b1e2e`             |
| `inputBorder`     | `#c5cce0`               | `#343a58`             |
| `chipInactiveBg`  | `#e6eaf5`               | `#242840`             |
| `surfaceElevated` | `#ffffff`               | `#232740`             |
| `overlayScrim`    | `rgba(16, 20, 48, 0.5)` | `rgba(0, 0, 0, 0.65)` |
| `focusRing`       | `#2f6fed`               | `#8aa4ff`             |

Palette is derived from the BKM logo: navy `#202860` (ink), steel blue `#506898` (inkMuted), red `#dc2f2f` (primary, project extension: `--BKM_WebShop-primary`).

Dark mode principle: "dim, don't invert" — elevated surfaces are brighter than cards.

## Accent colors

| Token                  | Light                 | Dark                  |
| ---------------------- | --------------------- | --------------------- |
| `amber`                | `#fbbf24`             | `#fbbf24`             |
| `green`                | `#10b981`             | `#34d399`             |
| `danger`               | `#ef4444`             | `#f87171`             |
| `info`                 | `#0ea5e9`             | `#38bdf8`             |
| `violet` / `violetInk` | `#a855f7` / `#6d28d9` | `#c4b5fd` / `#c4b5fd` |
| `blue`                 | `#0ea5e9`             | `#60a5fa`             |
| `pink` / `pinkInk`     | `#f43f5e` / `#be123c` | `#fb7185` / `#fda4af` |
| `orange` / `orangeInk` | `#f97316` / `#c2410c` | `#fb923c` / `#fdba74` |
| `teal` / `tealInk`     | `#14b8a6` / `#0f766e` | `#2dd4bf` / `#5eead4` |

Amber hover/pressed shades (both themes): `700 = #a16207`, `900 = #7c2d12`.

## CSS variables

Tokens are exposed as `--BKM_WebShop-*` custom properties on `<html>` (e.g. `--BKM_WebShop-ink`, `--BKM_WebShop-bg`, `--BKM_WebShop-radius-lg`, `--BKM_WebShop-space-sm`).
