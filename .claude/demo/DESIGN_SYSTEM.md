# Demo Pages Design System

A minimal, professional design system for all ngx-virtual-dnd demo pages.

## Color Palette

### Primary

| Token                   | Value     | Usage                         |
| ----------------------- | --------- | ----------------------------- |
| `--color-primary`       | `#3b82f6` | Buttons, links, active states |
| `--color-primary-hover` | `#2563eb` | Primary hover state           |
| `--color-primary-light` | `#eff6ff` | Badges, subtle highlights     |

### Accent

| Token            | Value     | Usage                               |
| ---------------- | --------- | ----------------------------------- |
| `--color-accent` | `#60a5fa` | Gradient endpoint, secondary accent |

### Semantic

| Token                   | Value     | Usage                    |
| ----------------------- | --------- | ------------------------ |
| `--color-success`       | `#10b981` | Success states           |
| `--color-success-light` | `#d1fae5` | Active drop zone overlay |

### Neutrals

| Token                  | Value     | Usage                  |
| ---------------------- | --------- | ---------------------- |
| `--color-bg`           | `#f5f7fa` | Page background        |
| `--color-surface`      | `#ffffff` | Cards, panels          |
| `--color-border`       | `#e2e8f0` | Borders, dividers      |
| `--color-border-hover` | `#cbd5e1` | Border hover state     |
| `--color-text`         | `#1e293b` | Primary text           |
| `--color-text-muted`   | `#64748b` | Secondary text, labels |
| `--color-text-subtle`  | `#94a3b8` | Hints, placeholders    |

## Typography

**Font family:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
**Monospace:** `'JetBrains Mono', 'Fira Code', monospace`

### Size Scale

| Token         | Size       | Usage               |
| ------------- | ---------- | ------------------- |
| `--text-xs`   | `0.75rem`  | Labels, hints       |
| `--text-sm`   | `0.875rem` | Body, controls      |
| `--text-base` | `1rem`     | Default body        |
| `--text-lg`   | `1.125rem` | Section headings    |
| `--text-xl`   | `1.25rem`  | Page section titles |
| `--text-2xl`  | `1.5rem`   | Hero/logo text      |

## Spacing

4px base unit scale:

| Token         | Value  |
| ------------- | ------ |
| `--space-xs`  | `4px`  |
| `--space-sm`  | `8px`  |
| `--space-md`  | `16px` |
| `--space-lg`  | `24px` |
| `--space-xl`  | `32px` |
| `--space-2xl` | `48px` |

## Components

### Header / Hero

- Background: `linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)`
- Text: white
- Padding: `--space-xl` vertical, `--space-lg` horizontal
- Max-width content: `1200px`, centered

### Cards / Panels

- Background: `var(--color-surface)`
- Border radius: `12px` (`--radius-lg`)
- Shadow: `var(--shadow)` — `0 1px 3px 0 rgb(0 0 0 / 0.1)`
- No border (shadow provides separation)

### List Items (Draggable)

- **Uniform styling** — no per-item colors
- Background: `var(--color-surface)` (white)
- Height: fixed per demo (50px main, 72px task manager)
- Border bottom: `1px solid var(--color-border)`
- Text color: `var(--color-text)`
- Hover: subtle background `var(--color-bg)`
- Drag handle: `var(--color-text-subtle)`, hover → `var(--color-primary)`

### List Containers

- **No visible background color** — containers are transparent
- Only the page background (`--color-bg`) shows through
- Active drop zone: `var(--color-success-light)` background

### Buttons

**Primary:**

- Background: `var(--color-primary)`
- Text: white
- Hover: `var(--color-primary-hover)`
- Height: `36px`, border-radius: `--radius` (8px)

**Secondary:**

- Background: `var(--color-bg)`
- Border: `1px solid var(--color-border)`
- Text: `var(--color-text)`
- Hover: background `var(--color-border)`

### Form Controls

- Height: `36px`
- Border: `1px solid var(--color-border)`
- Border radius: `--radius` (8px)
- Focus: primary border + `0 0 0 3px var(--color-primary-light)` ring
- Font size: `--text-sm`

### Badges / Chips

- Background: `var(--color-primary-light)`
- Text: `var(--color-primary)`
- Border radius: pill (`999px`)
- Font weight: 600

### Settings Panel

- Collapsible card with header button
- Grid layout for settings groups (auto-fit, min 200px)
- Group titles: uppercase, `--text-xs`, `--color-text-muted`

## Effects

| Token          | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| `--shadow-sm`  | `0 1px 2px 0 rgb(0 0 0 / 0.05)`                                      |
| `--shadow`     | `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`      |
| `--shadow-md`  | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`   |
| `--shadow-lg`  | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` |
| `--radius-sm`  | `6px`                                                                |
| `--radius`     | `8px`                                                                |
| `--radius-lg`  | `12px`                                                               |
| `--radius-xl`  | `16px`                                                               |
| `--transition` | `150ms ease`                                                         |

## Key Principles

1. **No rainbow item colors** — list items use uniform white backgrounds
2. **No list container backgrounds** — only the page background shows; containers are transparent
3. **Consistent header gradient** — same `primary → accent` gradient on both demos
4. **Minimal shadows** — cards use `--shadow`, elevated elements use `--shadow-md`
5. **Accessible contrast** — all text meets WCAG AA against its background
