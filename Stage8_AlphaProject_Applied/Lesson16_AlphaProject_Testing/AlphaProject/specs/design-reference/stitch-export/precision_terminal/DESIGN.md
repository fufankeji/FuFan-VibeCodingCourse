---
name: Precision Terminal
colors:
  surface: '#10131a'
  surface-dim: '#10131a'
  surface-bright: '#363941'
  surface-container-lowest: '#0b0e15'
  surface-container-low: '#191b23'
  surface-container: '#1d2027'
  surface-container-high: '#272a31'
  surface-container-highest: '#32353c'
  on-surface: '#e1e2ec'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e1e2ec'
  inverse-on-surface: '#2e3038'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#ffb95f'
  on-secondary: '#472a00'
  secondary-container: '#ee9800'
  on-secondary-container: '#5b3800'
  tertiary: '#ffb786'
  on-tertiary: '#502400'
  tertiary-container: '#df7412'
  on-tertiary-container: '#461f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#10131a'
  on-background: '#e1e2ec'
  surface-variant: '#32353c'
  bull: '#EF4444'
  bear: '#22C55E'
  breakthrough: '#6366F1'
  anomaly: '#FACC15'
  surface-base: '#09090B'
  surface-card: '#18181B'
  surface-border: '#27272A'
typography:
  display-price:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  table-header:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  table-data:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  mono-label:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 12px
  ai-commentary:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  caption:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-margin: 1rem
  stack-gap: 0.5rem
  table-cell-px: 0.5rem
  table-cell-py: 0.25rem
  grid-gutter: 0.75rem
---

## Brand & Style

The design system is engineered for high-frequency financial monitoring, prioritizing **information density, technical precision, and rapid cognition**. It adopts a **Corporate / Modern** aesthetic with a "Terminal" influence, favoring utility over decorative whitespace. 

The system is designed for a disciplined, data-driven persona who treats the interface as a high-performance tool. Every visual element serves a functional purpose: alerting the user to market anomalies, distinguishing AI insights from raw data, and maintaining focus on portfolio performance amidst a dense field of observation stocks. The atmosphere is serious, authoritative, and efficient.

## Colors

The palette is rooted in a **Dark Mode** first philosophy to reduce eye strain during prolonged monitoring. 

- **Sentiment Colors:** Adheres strictly to A-Share standards: **Red (`#EF4444`) for gains (Bull)** and **Green (`#22C55E`) for losses (Bear)**.
- **Surface Logic:** Uses deep charcoal (`#09090B`) for the base and slate-toned containers (`#18181B`) to create subtle hierarchy without heavy shadows.
- **Functional Accents:** Indigo/Blue is used for technical breakthroughs, while Amber/Yellow is reserved for volume anomalies and "Budget Guard" system alerts.
- **Portfolio Highlighting:** User-held positions use a higher luminosity border or a primary blue tint to separate them from the general observation grid.

## Typography

Typography is optimized for the **legibility of numerical strings**. 

- **Inter** is the primary typeface for its neutral character and excellent tabular lining figures, ensuring price columns align perfectly.
- **JetBrains Mono** is utilized for stock codes and technical metadata to provide a distinct "data-heavy" terminal feel.
- **Hierarchy:** We use a compact scale. The largest "Display Price" is reserved for portfolio stocks. Most interface text stays between 11px and 13px to facilitate the requirement of viewing 30+ stocks per screen.
- **Mobile adjustments:** On mobile devices, `table-data` remains 13px but horizontal padding is reduced to prevent wrapping of stock names.

## Layout & Spacing

The layout follows a **Fixed-Fluid hybrid** model. The Dashboard utilizes a 12-column grid on desktop, reflowing to a single column list on mobile.

- **Information Density:** We utilize a "Compact" spacing rhythm. Standard vertical cell padding is set to `0.25rem` (4px) to maximize row count.
- **Sections:** The interface is divided into four primary functional zones: Market Overview (top), Portfolio Monitor (pinned/highlighted), News/AI Insights (side/drawer), and the Global Stock Grid (main).
- **Breakpoints:**
  - **Mobile (<768px):** Swaps grid cards for a condensed list view; hides secondary columns (e.g., Amplitude) to focus on Price and Change%.
  - **Desktop (>1024px):** Displays full data tables with sticky headers for the 30+ stock grid.

## Elevation & Depth

This system uses **Tonal Layering** and **Low-contrast Outlines** instead of traditional shadows to maintain a flat, professional "Dashboard" look.

- **Level 0 (Base):** `#09090B` — The main background.
- **Level 1 (Card/Section):** `#18181B` with a 1px solid border of `#27272A`. This is used for standard stock cards and grid containers.
- **Level 2 (Active/Hover):** `#27272A` background. Used for row highlights and active stock selection.
- **Level 3 (Overlays):** Side drawers for settings or stock details use a slight elevation with a 10% black shadow to separate them from the main grid.
- **AI Surfaces:** Sections containing AI-generated text use a subtle indigo inner-glow or border tint to distinguish "Machine Insight" from "Market Reality."

## Shapes

The shape language is **Soft-Geometric**. A standard `0.25rem` (4px) radius is applied to most UI components to maintain a modern feel while remaining space-efficient. 

- **Badges:** Status badges (Up/Down/Breakthrough) use the `rounded-sm` (2px) or `rounded-md` (4px) setting. Pill shapes are avoided to prevent wasted horizontal space in dense tables.
- **Buttons:** Action buttons in drawers and settings use a standard 4px radius.
- **Inputs:** Search and filter bars use 4px radius with a prominent 1px border.

## Components

- **Stock Cards:** Used for Portfolio stocks. High-contrast typography for price, with a small sparkline if possible. Borders are thickened to 2px for held positions.
- **Data Tables:** The core of the system. Rows use a alternating "Zebra" tinting (very subtle) or a 1px bottom border. Hover states must be instantaneous.
- **Status Badges:** Small, high-saturation rectangles with white or black text. They feature a "Light motion" (pulse) only when a new breakthrough is detected.
- **AI Insights:** Specialized cards with a distinct AI icon. Text is limited to 200 words and always ends with a greyed-out disclaimer component.
- **Budget Guard Banner:** A full-width yellow warning bar that appears at the top of the dashboard when LLM token limits are approached.
- **Feishu Cards:** For the messaging surface, use a simplified version of the web components, prioritizing the "Bull/Bear" status badges and the AI summary.