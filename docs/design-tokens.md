# Design Token Reference

## Color Tokens

### Primary (Green)

| Tailwind Class | Hex | CSS Variable | Usage |
|---|---|---|---|
| `bg-primary-900` | `#14532d` | `--color-primary-900` | Key headers, primary actions |
| `bg-primary-700` | `#15803d` | `--color-primary-700` | Interactive elements, links, focus rings |
| `bg-primary-100` | `#dcfce7` | `--color-primary-100` | Success states, open locks |

### Surface (Sand)

| Tailwind Class | Hex | CSS Variable | Usage |
|---|---|---|---|
| `bg-surface-warm` | `#fef3c7` | `--color-surface-warm` | Warm backgrounds, accents |
| `bg-surface-base` | `#fffbeb` | `--color-surface-base` | Page backgrounds |

### Action

| Tailwind Class | Hex | CSS Variable | Usage |
|---|---|---|---|
| `bg-action-warning` | `#f59e0b` | `--color-action-warning` | Warning states, stale indicators |
| `bg-action-error` | `#dc2626` | `--color-action-error` | Error states, locked indicators |

### Neutral (Stone)

| Tailwind Class | Hex | CSS Variable | Usage |
|---|---|---|---|
| `text-neutral-900` | `#1c1917` | `--color-neutral-900` | Primary text |
| `text-neutral-600` | `#57534e` | `--color-neutral-600` | Secondary text |
| `border-neutral-200` | `#e7e5e4` | `--color-neutral-200` | Borders, dividers |

For neutral shades beyond 900/600/200, use Tailwind's built-in `stone` scale directly (e.g., `stone-50`, `stone-100`, `stone-300`, `stone-400`, `stone-500`, `stone-700`, `stone-800`, `stone-950`).

### Focus Ring

| CSS Variable | Value | Usage |
|---|---|---|
| `--ring-brand` | `21 128 61` (RGB) | Focus outlines — consumed as `rgb(var(--ring-brand))` |
| `--fg-shell` | `28 25 23` (RGB) | Shell text — consumed as `rgb(var(--fg-shell))` |

## Spacing Tokens

8px base rhythm. Use these named tokens in preference to Tailwind's numeric scale.

| Token | rem | px | Example |
|---|---|---|---|
| `1x` | 0.5rem | 8px | `p-1x` |
| `1.5x` | 0.75rem | 12px | `p-1.5x` |
| `2x` | 1rem | 16px | `p-2x` |
| `2.5x` | 1.25rem | 20px | `p-2.5x` |
| `3x` | 1.5rem | 24px | `p-3x` |
| `4x` | 2rem | 32px | `p-4x` |
| `5x` | 2.5rem | 40px | `p-5x` |
| `6x` | 3rem | 48px | `p-6x` |
| `8x` | 4rem | 64px | `p-8x` |
| `10x` | 5rem | 80px | `p-10x` |
| `12x` | 6rem | 96px | `p-12x` |

## Typography Tokens

| Token | Value | Usage |
|---|---|---|
| `text-label` | 0.875rem / 1.25rem / 500 | UI labels, compact text |
| `font-sans` | Inter, system-ui, sans-serif | Body text (Inter degrades to system-ui) |
| `font-mono` | ui-monospace, SFMono-Regular, monospace | Scores, timing data |

## Migration Mapping (Old → New)

This table maps the deprecated class patterns to their token replacements. Component migration happens in subsequent stories.

### Primary Brand Colors

| Old Class | New Class | Notes |
|---|---|---|
| `bg-emerald-700` | `bg-primary-700` | Interactive elements |
| `text-emerald-700` | `text-primary-700` | Links, active text |
| `bg-emerald-50` | `bg-primary-100` | Light backgrounds (close match) |
| `text-emerald-800` | `text-primary-900` | Dark brand text |
| `border-emerald-200` | `border-primary-100` | Brand borders |
| `bg-blue-600` | `bg-primary-700` | Primary buttons |
| `hover:bg-blue-700` | `hover:bg-primary-900` | Button hover |
| `text-blue-600` | `text-primary-700` | Links |
| `focus:ring-blue-500` | `focus:ring-primary-700` | Focus rings |

### Neutral Colors

| Old Class | New Class | Notes |
|---|---|---|
| `text-slate-900` / `text-gray-900` | `text-neutral-900` | Primary text |
| `text-slate-600` / `text-gray-600` | `text-neutral-600` | Secondary text |
| `border-slate-200` / `border-gray-200` | `border-neutral-200` | Borders |
| `bg-white` | `bg-white` | Keep as-is (not tokenized) |
| `bg-stone-50` / `bg-gray-50` | `bg-surface-base` | Page backgrounds |
| `text-slate-500` / `text-gray-500` | `text-stone-500` | Tertiary text (use stone scale) |

### Status Colors

| Old Class | New Class | Notes |
|---|---|---|
| `text-red-600` / `bg-red-600` | `text-action-error` / `bg-action-error` | Error/locked states |
| `text-amber-800` / `bg-amber-100` | `text-action-warning` / related | Warning states |
| `bg-sky-50` | `bg-primary-100` | Selected states (reassign to brand) |

### Hardcoded Values

| File | Old Value | New Token |
|---|---|---|
| `src/app/layout.tsx` | `#1f5d3f` | `#15803d` (primary-700) |
| `src/components/uiStyles.ts` | `#f6f1e7`, `#eef3ea`, `#e7efe8` | `surface-*` tokens |
| `src/components/GolferDetailSheet.tsx` | `#f8f5ee` | `surface-*` tokens |
