---
name: "Guild of Second Chances"
description: "A narrative RPG management idle game — warm dark fantasy with guild-hall firelight and ceremonial gold accents"
colors:
  warm-dusk: "#14120e"
  gilded-surface: "#201c15"
  gilded-surface-hover: "#2b2519"
  aged-brass: "#3a3324"
  parchment-cream: "#ece7db"
  warm-ember: "#a1997f"
  shadow-ash: "#7d765f"
  guild-gold: "#ffd75e"
  muted-gold: "#a98f3a"
  emerald-growth: "#8fdc6f"
  battle-wound: "#ff8b7a"
  frost-crystal: "#7ec8ff"
  azure-lore: "#6fa8ff"
  arcane-violet: "#c07eff"
  blazing-sun: "#ff9d3d"
  royal-magenta: "#ff5ed4"
typography:
  display:
    fontFamily: "'Cinzel', 'Cinzel Decorative', 'Playfair Display', serif"
    fontSize: "clamp(1.5rem, 4vw, 2.4rem)"
    fontWeight: 700
    lineHeight: 1.1
  headline:
    fontFamily: "'Cinzel', 'Cinzel Decorative', 'Playfair Display', serif"
    fontSize: "clamp(1.2rem, 3vw, 1.8rem)"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "'Cinzel', 'Cinzel Decorative', 'Playfair Display', serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "'Source Sans 3', 'Source Sans Pro', 'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Source Sans 3', 'Source Sans Pro', 'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "0.66rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.02em"
  small:
    fontFamily: "'Source Sans 3', 'Source Sans Pro', 'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
  mono:
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "8px"
  md: "10px"
  lg: "14px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "14px"
touch: "44px"
components:
  button-primary:
    backgroundColor: "linear-gradient(180deg, #4a3d16, #332a0f)"
    textColor: "{colors.guild-gold}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    border: "1px solid {colors.muted-gold}"
    height: "{touch}"
  button-default:
    backgroundColor: "{colors.gilded-surface-hover}"
    textColor: "{colors.parchment-cream}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    border: "1px solid {colors.aged-brass}"
    height: "{touch}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.battle-wound}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    border: "1px solid #703038"
    height: "{touch}"
  tab-default:
    backgroundColor: "transparent"
    textColor: "{colors.warm-ember}"
    rounded: "{rounded.sm}"
    padding: "5px 2px"
    height: "{touch}"
  tab-active:
    backgroundColor: "{colors.gilded-surface-hover}"
    textColor: "{colors.guild-gold}"
    rounded: "{rounded.sm}"
    padding: "5px 2px"
    height: "{touch}"
  row-default:
    backgroundColor: "{colors.gilded-surface}"
    textColor: "{colors.parchment-cream}"
    rounded: "{rounded.md}"
    padding: "9px 11px"
    border: "1px solid {colors.aged-brass}"
  row-interactive:
    backgroundColor: "linear-gradient(180deg, {colors.gilded-surface-hover}, {colors.gilded-surface})"
    textColor: "{colors.parchment-cream}"
    rounded: "{rounded.md}"
    padding: "9px 11px"
    border: "1px solid {colors.aged-brass}"
  card:
    backgroundColor: "{colors.gilded-surface}"
    textColor: "{colors.parchment-cream}"
    rounded: "{rounded.md}"
    padding: "9px 11px"
    border: "1px solid {colors.aged-brass}"
  modal:
    backgroundColor: "{colors.gilded-surface}"
    textColor: "{colors.parchment-cream}"
    rounded: "{rounded.lg}"
    padding: "18px"
    border: "1px solid {colors.muted-gold}"
  click-button:
    backgroundColor: "linear-gradient(180deg, #2a2410, #1e1a0c)"
    textColor: "{colors.guild-gold}"
    rounded: "{rounded.lg}"
    padding: "14px"
    border: "2px solid {colors.muted-gold}"
  subtab-default:
    backgroundColor: "{colors.gilded-surface}"
    textColor: "{colors.warm-ember}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    border: "1px solid {colors.aged-brass}"
    height: "38px"
  subtab-active:
    backgroundColor: "{colors.gilded-surface-hover}"
    textColor: "{colors.guild-gold}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    border: "1px solid {colors.muted-gold}"
    height: "38px"
  toggle-off:
    backgroundColor: "{colors.warm-dusk}"
    textColor: "{colors.parchment-cream}"
    rounded: "13px"
    border: "1px solid {colors.aged-brass}"
    height: "26px"
    width: "44px"
  toggle-on:
    backgroundColor: "{colors.muted-gold}"
    rounded: "13px"
    border: "1px solid {colors.aged-brass}"
    height: "26px"
    width: "44px"
---

# Design System: Guild of Second Chances

## Overview

**Creative North Star: "The Guild Hall Fire"**

The interface is a guild hall at dusk: deep wood-panelled walls, warm candlelight, the gleam of gold on dark surfaces. Every screen sits in this room — the fire is always within sight, even when the player is deep in a menu or studying an item's stats. The warmth comes from the palette (cream text on brown-black grounds, gold as the voice of action and progress) and from the craft: borders are burnished brass, interactive elements lift with purpose, and every rarity tier has its own distinct gem-like glow.

The game's RPG systems (adventurers, equipment, stats) demand scanability and density, so the visual system stays disciplined under the fantasy surface. Typography carries the gravitas — Cinzel for the guild's voice, Source Sans 3 for the ledgers — while spacing, radius, and tonal layering keep information legible on a phone-sized screen.

**Key Characteristics:**
- **Warm dark:** not blue-black or neutral grey, but warm brown-black — the dark of a fire-lit interior.
- **Gold as action:** the accent isn't decorative; it marks wealth, progress, interactive intent, and the player's agency.
- **Tonal depth:** surfaces stack by luminance, not by shadow. The deeper the surface, the darker the tone.
- **Ceremonious components:** buttons have linear gradients, distinct borders, and press feedback — every action feels weighty.
- **Purposeful motion:** every animation serves feedback (press, progress, notification), ceremony (ascension, story beats), or spatial orientation (sheet rise, dropdown). No decorative loops, no idle spinner.
- **Jewel-box rarities:** five rarity tiers with distinct hues (blue → purple → orange → magenta) each with tinted surfaces and soft glows.
- **Reduced motion as a system property:** animations degrade gracefully. The `.reduced-motion` class and `prefers-reduced-motion` media query are first-class system constraints, not afterthoughts.

## Colors

The palette is built around a warm hearth core: deep wood-brown background, gold flame accent, parchment-cream text. Cool tones enter only for supernatural elements (Time Shards as frost-blue, arcane rarity as violet) — the fire warms the room, but magic has its own light.

### Primary
- **Guild Gold** (#ffd75e): The game's voice of agency and wealth. Used for gold/resource amounts, active tabs, interactive row highlights, the primary button variant, and all "this is actionable" signals. Appears as text, as a border highlight, and as a linear gradient fill on ceremonial click-buttons.
- **Muted Gold** (#a98f3a): The structural companion to Guild Gold. Borders, secondary highlights, and the dimmed partner that lets gold appear without overwhelming the composition.

### Neutral
- **Warm Dusk** (#14120e): The deepest surface — body background and progress-track fill. Reads as almost-black with a brown undertone, never as neutral #111.
- **Gilded Surface** (#201c15): The primary panel surface. All cards, rows, modals, and tab bars sit on this tone. The difference from Warm Dusk is subtle — just enough lift to establish surface hierarchy.
- **Gilded Surface Hover** (#2b2519): One step lighter still: hover states for panels, active tab backgrounds, and default button fills.
- **Aged Brass** (#3a3324): Borders, dividers, and the outline of every container. Warm enough to read as metallic trim rather than wireframe lines.
- **Parchment Cream** (#ece7db): Primary body text. Warm off-white that sits softly against the dark grounds — never a cold #fff.
- **Warm Ember** (#a1997f): Secondary text — subtitles, descriptions, hints, dimmed labels. At ~6:1 on Gilded Surface, clears WCAG AA comfortably.
- **Shadow Ash** (#7d765f): The faintest text tone. Used only for genuinely unavailable content (disabled buttons, locked rows, placeholder hints). Anything fainter must not carry information.

### Secondary (Rarity & Status)
- **Emerald Growth** (#8fdc6f): Affirmation and progression. XP bars, positive stat deltas, maxed rows, quest completion, the Found Guild button, and any "good" state signal.
- **Battle Wound** (#ff8b7a): Danger and injury. HP bars, negative stat deltas, injury indicators, warning borders, the danger button variant, and the log filter for combat injuries.
- **Frost Crystal** (#7ec8ff): The prestige currency (Time Shards) and anything related to time-manipulation or supernatural narrative beats. Cool blue against the warm palette reads as otherworldly.

### Tertiary (Rarity Spectrum)
- **Azure Lore** (#6fa8ff): Rare (blue) equipment — borders, tinted backgrounds, chip labels.
- **Arcane Violet** (#c07eff): Epic (purple) equipment — borders, tinted backgrounds, chip labels.
- **Blazing Sun** (#ff9d3d): Exalted (orange) equipment — borders, tinted backgrounds, a soft glow effect.
- **Royal Magenta** (#ff5ed4): Ascendant (magenta) equipment — the highest tier, with the strongest glow, tinted surfaces, and the ascension celebration animations.

### Named Rules
**The Hearth Rule.** Gold (Guild Gold) is always the warmest element on screen. No other color competes with it for the role of "what demands attention." When a rarity color or Frost Crystal appears, gold recedes to its structural role.

**The Rarity Gradient Rule.** Rarity tiers follow a fixed hue arc (blue → purple → orange → magenta) that never varies. Every equipment item, border, and label uses its tier's exact hue — no interpolation, no custom tints.

## Typography

**Display Font:** Cinzel (with Cinzel Decorative, Playfair Display, serif)
**Body Font:** Source Sans 3 (with Source Sans Pro, Inter, system-ui, -apple-system, sans-serif)
**Label/Mono Font:** SF Mono (with Fira Code, Consolas, monospace)

**Character:** Cinzel brings inscribed-stone gravitas — the guild's proclamations, the time-crystal's name, every story title. Source Sans 3 is the working scribe's hand: legible at small sizes on a phone, humanist warmth that doesn't compete with the display face. The pairing says "fantasy world, functional interface" — one voice for ceremony, one for the ledgers.

### Hierarchy
- **Display** (700, clamp(1.5rem, 4vw, 2.4rem), 1.1): Gold resource amounts, story titles, ceremonial headers. Tabular-nums always on. Rarely more than one per screen.
- **Headline** (700, clamp(1.2rem, 3vw, 1.8rem), 1.2): Section titles, modal headers, prestige amounts. The secondary Cinzel tier.
- **Title** (700, 1rem, 1.3): Row names, item names, panel section headers. The smallest Cinzel step — after this, the hierarchy hands off to Source Sans.
- **Body** (400, 0.85rem, 1.5): The game's default text size. Used for descriptions, story text, stats, item details. Max line length ~65–75ch.
- **Small** (400, 0.75rem, 1.4): Subtitles, secondary descriptions, progress times, log content.
- **Label** (600, 0.66rem, 1.25, 0.02em letter-spacing): Tab labels, section-title metadata, attribute abbreviations, stat labels. Uppercased only where the component calls for it (e.g. rarity badges).
- **Mono** (400, 0.85rem): Not a UI voice — reserved for debug panels and console output.

### Named Rules
**The One Cinzel Per View Rule.** No more than one Cinzel element per distinct visual region — the gold amount in the header, a story title in a modal, a headline on a panel. Two Cinzel elements in the same viewport compete for the ceremonial voice and both lose.

## Layout

The game uses a single-column mobile-first layout constrained to 520px max width, centered on desktop. Content flows vertically inside `.game` with `12px` side padding and a `--gap-md` (10px) vertical rhythm between sections.

**Container:** `.game` — 520px max-width, horizontal centering, `12px` gutters, bottom padding clears the fixed tab bar.

**Header:** Sticky resource bar at top — gold amount (display), gold-per-second (emerald), day counter, shard count, settings gear. Single row, compact, always visible.

**Tab bar:** Fixed bottom navbar with 5 destinations (Overview, Town, Guild, Map, Items) distributed evenly. Each tab is 44px minimum touch target, capped at `.tab-bar` width. Tabs reveal progressively as acts unlock.

**Panels:** Each panel fills the scroll area between header and tab bar. Sections within a panel are separated by `.section-title` labels (label-size, Cinzel, dimmed gold) and a `--gap-md` vertical rhythm. Rows stack with `--gap-sm` (6px).

**Grids:**
- Attribute grid: 6-column at ≥420px, 3-column below — equal-weight cells with label, abbr, value.
- Equipment grid: 3-column at ≥480px, 2-column below.
- Skill tree: 2-column at ≥480px, 1-column below.
- Stat grid: auto-fill with min 84px columns.
- Stat bars (detail view): 3-column desktop (32px label | 1fr track | 28px value).

**Density:** Tight within groups (4–10px), generous between groups (14px). Modals use the same internal rhythm (`--gap-md`) plus a `14px` body padding.

**Responsive breaks:**
- 560px and below: modals dock to bottom as sheets (`border-radius` top only, no bottom border).
- 480px and below: equipment grid condenses, skill tree stacks.
- 420px and below: attribute grid condenses.

## Elevation & Depth

The system is **flat-by-default, lifted strategically**. Content hierarchy is conveyed through tonal layering — surfaces stack by luminance, not by shadow depth. Shadows are reserved exclusively for floating UI: modals, dropdown menus, toasts, and the tab bar's separation from content.

**Tonal layering** (warm-dusk → gilded-surface → gilded-surface-hover): each step is a perceptible but subtle luminance jump (~3–5%). The body background is the darkest; panel surfaces sit one step lighter; hover states nudge another step up. This creates depth through material weight rather than simulated light.

**When shadows appear:**
- **Modals & dropdowns** (`box-shadow: 0 12px 40px rgba(0,0,0,0.6)`): the modal backdrop creates atmospheric depth. Dropdown menus use one step lighter (`0 8px 24px rgba(0,0,0,0.5)`).
- **Tab bar** (`box-shadow: 0 -6px 20px rgba(0,0,0,0.4)`): anchors the fixed navigation against the scrolling content above it.
- **Toasts** (`box-shadow: 0 6px 20px rgba(0,0,0,0.45)`): floating notifications need separation from all surfaces.
- **Rarity glows** (`box-shadow: 0 0 8px rgba(...)`): exalted and ascendant items earn a colored glow — not a depth shadow but a material aura.

### Named Rules
**The Flat-by-Default Rule.** Surfaces at rest have no shadow. A shadow must be earned by being a floating element (modal, dropdown, toast, fixed bar) or a rarity glow. If it sits in the scroll flow, it's tonal, not lifted.

## Motion & Animation

Motion in the guild hall is purposeful, not decorative. Every animation answers a specific need: acknowledging input, revealing state change, or marking ceremony. The system has three motion tiers:

| Tier | Duration | Easing | Purpose |
|------|----------|--------|---------|
| **Instant** | ≤60ms | None (transform snap) | Press feedback — the action and its acknowledgment must feel simultaneous. Longer feels sluggish. |
| **Fast** | 100–250ms | `ease-out` (decelerate) | State transitions — hover, focus, toggle, border shift, color change. Smooth arrival, no waiting. |
| **Ceremonial** | 700ms–1.6s | `ease-out` or custom spring | Celebration moments — ascension, click-pop float, sparkle trails. These own the player's attention briefly. |

**Easing philosophy:** `ease-out` is the default for all authored motion. Elements arrive at their destination smoothly and stop — no bounce, no overshoot unless the moment is explicitly celebratory. The single exception is the ascension pop-in (`cubic-bezier(0.34, 1.56, 0.64, 1)`), a spring-like overshoot that earns its playfulness by being rare.

### UI State Transitions

The majority of motion in the system is **state-driven transitions**, not keyframe animations. Hover, focus, active, disabled, and selected states all transition on a 100–150ms ease-out curve.

- **Border/background/color transitions:** `0.12s ease-out` for buttons, interactive rows, tabs, subtabs. Fast enough to feel responsive, slow enough to read as a deliberate state change rather than a glitch.
- **Press transform:** `0.05s–0.06s` (near-instant) for both buttons (`scale(0.97)`) and rows (`scale(0.995)`). The press snap is faster than any easing curve — input acknowledgment must be immediate.
- **Progress fill:** `width 0.2s linear` — progress bars animate continuously so the fill never jumps. Linear easing keeps progress reading as mechanical and precise rather than eased and subjective.
- **Toggle:** `background 0.15s` — the knob slides as the track fills, one smooth motion.
- **Info note chevron:** `transform 0.15s` — rotates 180° on open/close.

### Keyframe Animations

Keyframes are reserved for **events that are not state changes** — things that happen, complete, and are done. Each has a clear trigger and a defined end state.

- **Click-pop (`click-pop-rise`, 0.7s):** A floating "+N" that rises 42px, scales from 0.8→1.1→1, and fades out. Spawned on each odd-job click. The 20% keyframe (scale 1.1) gives a brief emphasis pop before the float-away. Applied as `forwards` fill so the last keyframe holds.
- **Sheet slide-up (`sheet-rise`, 0.18s):** Mobile modal docks from the bottom — a short translateY(12px)→none with ease-out. 0.18s is fast enough that it reads as "the card was always there, it just snapped into view" rather than a theatrical entrance.
- **Toast enter/exit (`toast-in` 0.25s, `toast-out` 0.2s):** Toast slides up + fades in on appear, slides down + fades out on dismiss. The exit is faster (0.2s) so the stack clears without lingering.
- **Ascension glow pulse (`ascend-glow-pulse`, 1.6s infinite):** A radial gradient sphere that pulses from 0.7→1.5 scale with opacity 0.9→0.15. The slow period reads as breathing, not flashing.
- **Ascension glow fadeout (`ascend-glow-fadeout`, 1.2s):** A second glow layer that appears once and fades out, from 1.3→0.6 scale. Marks the moment of transition.
- **Ascension icon pop (`ascend-pop`, 0.7s, spring overshoot):** The only spring-like animation in the system — `cubic-bezier(0.34, 1.56, 0.64, 1)` scales the item icon from 0→1.15→1. The overshoot is earned by rarity: it only fires once per ascension event.
- **Ascension sparkles (`ascend-sparkle-rise`, 1.4s infinite):** Six sparkle icons orbit the item icon, each on a staggered delay (0.18s steps). They rise 70px and fade out, then repeat. The delay stagger prevents a uniform ring.

### PixiJS Battle Animations

The battle viewer is a separate rendering context (PixiJS canvas), but its motion language follows the same principles. All battle animations are code-driven (no CSS), running on a ticker at display refresh rate.

- **Lunge:** Fighter moves toward target over 180ms (`easeOutCubic` — `1-(1-t)³`). The cubic deceleration makes the approach feel committed without being jarring.
- **Impact:** White flash overlay on the defender for 120ms, fading in the first 60ms. All grouped hits (AOE/multi-hit) land simultaneously — one lunge, simultaneous impacts.
- **Recover:** Attacker returns to base position over 160ms (`easeInCubic` — `t³`). The slow start + fast finish reads as "pulling back from a strike."
- **Damage floaters:** Rise 30px and fade over 700ms. Size and color vary by hit type: normal damage (gold, 16px), crit (red, 22px with `!`), block (ice-blue, 13px with "Blocked"), DoT (orange, 14px), buff (green), status (purple), skill name (white, 10px above attacker).
- **Screen shake:** Random offset with linear decay over 200–320ms. Crits shake harder and longer than normal hits. No easing — the randomness *is* the feel.
- **Defeat burst:** 8 particles spawn at the defeated fighter's position with randomized velocity, gravity (0.05px/ms²), and fade. Particle life: 400–600ms.
- **Idle breathing:** All undefeated fighters oscillate ±1.5px on Y at a 400ms sine period. Subtle enough to go unnoticed until it's absent — then the battlefield reads as frozen.
- **Cooldown bar:** Snaps to the new value on each log entry — no interpolation. The bar is a signal, not a spectacle.

### Trigger Map

| Trigger | Animation | Duration |
|---------|-----------|----------|
| Button hover | Border-color shift | 0.12s |
| Button press | Scale transform | 0.05s |
| Button release | Scale revert | 0.05s |
| Row hover | Border-color shift | 0.12s |
| Row press | Scale transform | 0.06s |
| Odd-job click | Click-pop float "+N" | 0.7s |
| Progress update | Width transition | 0.2s |
| Toggle switch | Background + knob | 0.15s |
| Info note toggle | Chevron rotate | 0.15s |
| Tab/panel switch | Instant (no crossfade) | 0 |
| Modal open (mobile) | Sheet slide-up | 0.18s |
| Toast appear | Slide-up + fade | 0.25s |
| Toast dismiss | Slide-down + fade | 0.2s |
| Story beat appear | Instant (no entrance) | 0 |
| Arrival reveal (first run) | Camera settle + staged copy strike | 0.9–2.4s |
| Arrival departure (first run) | Camera acceleration + hearth bloom | 0.95s |
| Arrival → operating UI | View Transition: bloom morphs to header gold | 0.62s |
| Ascension celebration | Glow pulse + pop + sparkles | 0.7–1.6s |
| Battle: lunge | Fighter slides to target | 180ms |
| Battle: impact | White flash + damage number | 120ms |
| Battle: recover | Fighter slides back | 160ms |
| Battle: death | Particle burst | 400–600ms |

### Reduced Motion

Reduced motion is a first-class system property, not a post-hoc fix. When the user opts in (via settings toggle or `prefers-reduced-motion: reduce`):

1. **All keyframe animations are killed** — `animation: none` on click-pop, sheet-rise, toast animations, and all ascension animations (glow, pop, sparkles).
2. **Toasts fall back to opacity transitions** — the toast-out keyframe is replaced by `transition: opacity 0.15s`. The toast fades out without sliding.
3. **Ascension celebration renders its static end state** — no pulse, no pop, no sparkle animation. The glow sphere and icon are at rest; the before/after deltas are still visible.
4. **No empty animation containers** — components that spawn animated elements (click-pop wrapper, ascend-stage) still render their containers; they just don't produce visible effects.

The `@media (prefers-reduced-motion: reduce)` query acts as a system-level override on the same classes. Both paths converge on the same visual end state.

### Named Rules
**The Decoration Rule.** If an animation cannot be named by what it communicates (press feedback, state change, ceremony, spatial orientation), it does not belong. Decorative looping animations — idle spinners, rotating icons, background parallax — are not part of the system.

**The Reduced Motion Invariant.** Every animated element has a non-animated end state that carries the same information. The reduced-motion path is not a degraded experience; it is the same experience without motion.

## Shapes

Forms are gently rounded with consistent radius steps. No sharp corners inside the guild hall — every container, button, and card has a softened edge.

- **Small radius** (8px): tabs, subtabs, small buttons, icon buttons, stat cells, attribute cells, info notes, toggles, switch knobs, rarity badges. The most common radius in the system.
- **Medium radius** (10px): rows (standard, interactive, static, locked), zone cards, equipment grid items, input fields, settings rows, dropdown menus, story continues, progress tracks.
- **Large radius** (14px): click buttons, modals, prestige-panel currency banners, ending banners.
- **Pill radius** (999px): perk tags (small inline labels).
- **Full round** (50%): toggle knobs, the ascension glow sphere.

**Borders** are 1px solid, colored Aged Brass. Interactive rows get a hover state that shifts the border to Muted Gold. Disabled/locked/unaffordable states use dashed borders instead of solid, signaling "this slot exists but is not available."

**Rarity borders** use their color's hue at full saturation, 1px width, plus a soft box-shadow glow for the top two tiers (Exalted, Ascendant). The glow is radial, not offset — it reads as material aura, not light casting a shadow.

**Interactive rows** display a chevron affordance (a 7px rotated L-shape, 1.5px stroke, colored Shadow Ash) to signal "tappable for detail view."

## Components

### Buttons
- **Shape:** Gently curved (8px) with 44px minimum height and horizontal padding (14px default).
- **Motion:** Hover (border-color shift, 0.12s ease-out), press (`scale(0.97)` at 0.05s snap), release (scale revert). Disabled state has no hover or press animation.
- **Default (small-button):** Gilded Surface Hover background, Parchment Cream text, Aged Brass border. On hover, border shifts to Muted Gold. On press, `scale(0.97)`. Disabled state: Shadow Ash text, transparent background, dashed border.
- **Primary (small-button.primary):** A linear gold gradient background (`#4a3d16 → #332a0f`), Guild Gold text and border. The filled variant flags the one action a screen is actually for. Disabled falls back to the default disabled look.
- **Danger (small-button.danger):** Transparent background, Battle Wound text, dark red border (`#703038`). On hover, border shifts to full Battle Wound saturation. Used for destructive actions (disassemble, fire, reset).
- **Click Button (.click-button):** The ceremonial action — two-pixel gold border, deeper gold gradient (`#2a2410 → #1e1a0c`), Guild Gold text. Large radius (14px). On press, `scale(0.97)`. **Motion payload:** spawns click-pop floaters (+N gold amounts that rise and fade over 0.7s). The floating numbers are the feedback loop for the game's core interaction.
- **Icon Button (.icon-button):** Square (44px), transparent, Warm Ember icon. On hover, Gilded Surface Hover background, Parchment Cream icon. Used for modal close, dismissible actions.
- **Danger Button (.danger-button):** Full-width variant for settings danger zone. Dark red background (`#2a1418`), Battle Wound text, pill-like radius (10px). No hover border shift — the single state is "act with caution."
- **Link Button (.link-button):** No border, no background — inherits parent typography, `underline dotted`. For inline actions that don't warrant a full button.

### Tabs (Fixed Bottom Nav)
- **Shape:** Evenly distributed across the bar, each flex:1. 44px minimum height with 5px top/bottom padding.
- **Motion:** Active tab swap is instant (no crossfade, no slide). Tab switching is navigation, not a state reveal — delaying it would feel like lag. Hover: 0.1s color transition.
- **Default:** Transparent background, Warm Ember text. Hover lifts text to Parchment Cream.
- **Active:** Gilded Surface Hover background, Guild Gold text and icon.
- **Layout:** Icon above label (two-line), label at xs size (0.66rem), 600 weight.
- **Tab bar container:** Fixed bottom, 520px max-width, Gilded Surface background, Aged Brass border, 12px top-radius, shadow separation from content.

### Rows / Cards
The fundamental container pattern — used for job listings, adventurer cards, zone cards, settings rows, and most list items.

- **Shape:** Medium radius (10px), Gilded Surface background, 1px Aged Brass border, 9px/11px padding.
- **Content layout:** Flex row — left side has `.row-info` (name sm + description xs vertically), right side has controls (cost, button, chevron).
- **Interactive variant:** A subtle linear gradient from Gilded Surface Hover to Gilded Surface, pointer cursor, and a `::after` chevron affordance. On hover, the border shifts to Muted Gold. On press, `scale(0.995)`.
- **Static variant (.row-static):** Transparent background, no border interaction, full-contrast Parchment Cream text. Used for read-only information that must stay legible.
- **Warning variant (.row-warning):** Battle Wound-tinted border and background wash (`color-mix` at 45% and 8%). Used for injury, danger, and high-risk states.
- **Locked/unaffordable variant:** Dashed Aged Brass border, Shadow Ash text, default cursor. The dashed border is the universal "not yet available" signal.
- **Perk/Skill rows:** 3px left border in the relevant color (Guild Gold for perks, Azure Lore for skills, Royal Magenta for gear perks) with a matching tinted background wash.

### Modals
- **Structure:** Three-part shell — fixed header (with title + close button), scrollable body, optional pinned footer.
- **Backdrop:** Fixed overlay, `rgba(0,0,0,0.72)`, z-index 10.
- **Container:** Max-width 440px, Gilded Surface background, 1px Muted Gold border, large radius (14px), deep shadow.
- **Header:** Flexible row — Cinzel title (Headline size) in Guild Gold on left, 44px icon-button close on right. Separated from body by 1px Aged Brass border.
- **Body:** Scrollable, `overscroll-behavior: contain`, gap-md rhythm, lg padding.
- **Footer:** Fixed at bottom, flex row of buttons (each flex:1), separated by 1px Aged Brass border, safe-area-aware padding.
- **Mobile (≤560px):** Docks to bottom as a sheet — 92vh max-height, only top corners rounded, slide-up animation (`translateY(12px) → none` over 0.18s ease-out).

### Inputs / Fields
- **Style:** Minimal — Warm Dusk background, Parchment Cream text, 1px Aged Brass border, small radius (8px), 38px minimum height.
- **Focus:** No outline shift — the component relies on its parent `.field-label` context for focus indication, or the default browser focus ring.
- **Disabled:** 0.4 opacity — signals read-only without altering the layout.
- **Select dropdowns:** Same pattern as inputs, applied to `<select>` elements.
- **Checkbox:** Standard 16px checkbox, inside a `.field-label.checkbox-label` row with flex-row alignment.

### Toggle
- **Shape:** 44×26px track, 13px pill radius, 1px Aged Brass border.
- **Motion:** Background + knob position transition at 0.15s. The single duration covers both the track fill and the knob slide — they move as one piece.
- **Off:** Warm Dusk background, knob left (20px circle, Parchment Cream fill).
- **On:** Muted Gold background, knob right.
- **Used in:** Settings panel for boolean preferences (sound, reduced motion, etc.).

### Section Title Row
A section header with an action button on the right — used when a content area needs both a label and a primary action (e.g., the Equipment section with "Auto-equip", the Running Quests section with a per-second toggle).

- **Layout:** Flex row, `justify-content: space-between`. `.section-title` on the left, a `.small-button` or inline toggle on the right.
- **Motion:** No animation on mount. The action button follows standard button hover/press motion.

### Empty Slot
A dashed-border placeholder for an unfilled roster or inventory slot. Used for champion recruitment and empty equipment pickers.

- **Shape:** Dashed 1px Aged Brass border, 10px radius, transparent background, centered content.
- **Content:** Plus icon (`+`) and call-to-action label ("Recruit Champion").
- **States:** On hover, border shifts to Guild Gold and text shifts to Guild Gold. No press scale — the interaction opens a modal rather than dispatching directly.

### Button Group / Option Selector (Craft Options)
A flex-wrap row of small selection buttons, used in the forge for slot/tier/quantity selection. Distinct from subtabs — these are smaller, wrapped, and each button commits a filter rather than navigating.

- **Shape:** Each button matches `.small-button` styling but without flex:1 — they size to content.
- **Active:** Uses the same `.active` class as subtabs (Guild Gold text, Muted Gold border, Panel Hover background).
- **Motion:** Active state transition at 0.12s. No slide or crossfade between options — switching is instant.

### Equip Picker
An inline list of candidate equipment items that appears below an equipment slot row after tapping "Equip"/"Change". Each item is a compact card with name, rarity, stats, and delta chips.

- **Shape:** Left-bordered (2px Aged Brass) nested list, each item is a button with `.equip-picker-item` styling — 8px radius, 1px border, tinted background per rarity.
- **Motion:** Appears instantly below the slot row (no slide-down or fade-in). Items use the same `filter: brightness(1.25)` hover as equipment grid tiles. No entrance animation — the picker replaces the button tap so fast it reads as responsive, not abrupt.
- **Delta chips:** Green up arrow + value for stat improvements, red down arrow for reductions, gray "no change" for identical stats.

### Perk Tag
An inline pill badge attached to a row name, signaling a special trait category (e.g., "Major Perk", "Gear Perk", "5-turn CD").

- **Shape:** Inline-block, `border-radius: 999px`, 0.05em letter-spacing, uppercase, 0.66rem / 600 weight, 12% tint of `currentColor` on transparent background.
- **Motion:** Static — tags appear with their parent row and have no hover or entrance animation. They are metadata labels, not interactive controls.

### Settings Row
A two-column layout: label + hint on the left, control on the right. Used only in the Settings panel.

- **Shape:** The containing row uses `.settings-row` (10px radius, 1px border, 12px/14px padding) — visually identical to a `.row` but with a different internal layout.
- **Content:** `.settings-text` (`.settings-label` + `.settings-hint`) on the left, the control element (toggle, select dropdown, button group) on the right.
- **Motion:** None — settings rows mount statically and have no hover interaction beyond whatever the control element provides.

### Confirm Modal
A modal variant for destructive or consequential actions (dismiss champion, reset save). Built on the same Modal shell but with a two-button footer and a message paragraph.

- **Icon support:** The title can optionally include an icon (warning triangle for reset, etc.).
- **Variants:** `danger` (cancel autofocuses, confirm uses danger button styling) or `primary` (confirm autofocuses).
- **Motion:** Follows the same modal motion as the base Modal component (sheet rise on mobile, instant on desktop).

### Progress Bar
- **Shape:** 6px height, 3px radius, Warm Dusk background, Aged Brass border, overflow hidden.
- **Fill:** Width set inline as percentage, colored per context: generic (Muted Gold), XP (Emerald Growth), HP (Battle Wound gradient `#d0473b → #ff8b7a`).
- **Motion:** `width 0.2s linear` — the fill animates continuously on every progress tick. No bounce, no easing — the linear curve reads as mechanical progress rather than subjective weight.
- **Reduced motion:** Width transition still runs (it's a CSS transition, not a keyframe, so it is not killed).

### Activity Log
A scrollable container showing recent in-game events, used in the Overview panel.

- **Shape:** `.activity-log` — capped at 220px max-height, scrollable, 10px radius, Aged Brass border, Gilded Surface background. Internal entries are 4px-apart flex rows.
- **Content:** Each `.log-entry` is a day stamp (.log-day, Warm Ember) + text (.log-text). Kind-specific coloring: combat injury (Battle Wound text), quest (Guild Gold text), expedition (Frost Crystal text).
- **Motion:** New entries appear instantly as the list re-renders. No slide-in or fade — the log is a readout, not a notification feed.

### Found Guild Button
A ceremonial Act 1 button with an integrated progress fill. Renders only when the player has enough gold to found the guild.

- **Shape:** Green gradient background (`#16240f → #101a0b`), 2px Emerald Growth border, 12px radius, Cinzel font, full-width, flex column.
- **Progress:** `.found-guild-track` is a 5px rounded track inside the button showing gold progress toward the founding goal. The fill uses Emerald Growth.
- **States:** `unaffordable` — the button stays visible but at 0.5 opacity, default cursor, no hover lift. Affordable — full opacity, clickable.
- **Motion:** The progress fill inside the button uses the same `width 0.2s linear` transition as standard progress bars.

### Prestige Beat Modal
A variant of the Story Modal used for prestige/time-travel narrative beats. Distinct visual theming to mark the transition between timelines.

- **Shape:** Same Modal shell, but with Frost Crystal border, deep blue gradient background (`#10222e → #0b1822`), Frost Crystal title and button.
- **Auto-dismiss:** Prestige beats auto-dismiss after 4 seconds (6 seconds in reduced motion) — they are narrative ceremony, not interactive dialog.
- **Motion:** No entrance animation (same as standard story modal). The blue-tinted border and background do the narrative work.

### Navigation (Tab Bar)
Covered under Tabs above. No sidebar, no top nav — the tab bar is the single navigation primitive. Settings lives in the header row as a gear button, not a tab.

### Toast System
- **Container:** Fixed stack, centered above the tab bar (bottom: 96px + safe-area), 440px max-width, z-index 7.
- **Toast:** Gilded Surface background, Aged Brass border, medium radius (10px), 12px/14px padding, light shadow, flex row with content + close button.
- **Tones:** Info (accent-gold border/icon), Success (Emerald Growth border/icon), Warning (Battle Wound border/icon).
- **Animation:** Slide up + fade in (0.25s ease-out), slide down + fade out (0.2s ease-in).
- **Reduced motion:** Opacity transition only, no keyframes.

### Rarity Badges & Equipment
- **Badge shape:** Border around text (small radius, 6px), uppercase, 0.05em letter-spacing, 600 weight. Each tier uses its color as both text and border.
- **Equipment grid items:** Card-like tiles (3-column or 2-column), colored border + tinted background per rarity tier. Top two tiers (Exalted, Ascendant) add a soft colored glow.
- **Selection:** 2px Guild Gold outline (`outline-offset: -1px`) on selected item.
- **Hover state:** `filter: brightness(1.25)` — a single uniform lighten that preserves the underlying rarity tint.

## Do's and Don'ts

### Do:
- **Do** use Guild Gold as the single point of action on any screen. When everything is gold, nothing is.
- **Do** use tonal layering (darker → lighter surfaces) for depth instead of shadows. Shadows are for floating elements only.
- **Do** keep rarity colors locked to their hue positions in the arc (blue → purple → orange → magenta). No interpolation between tiers.
- **Do** use dashed borders as the universal "unavailable" signal — works for locked rows, disabled buttons, empty slots.
- **Do** let Cinzel breathe — one display-face element per viewport, not competing voices.
- **Do** make every tappable element at least 44px in one dimension. The game is thumb-operated on phones.
- **Do** use ease-out for authored motion. Elements should arrive at their destination and stop — no bounce, no overshoot unless the moment is specifically ceremonial.
- **Do** animate press feedback with a transform snap (≤60ms), not a longer transition. Input acknowledgment must feel simultaneous with the finger.
- **Do** use reduced-motion variants for every animated element: prefer opacity transitions over keyframe-driven animations when the user opts out.
- **Do** give every ceremonial animation a static end state that carries the same information — the reduced-motion path is not a degraded experience.

### Don't:
- **Don't** put body text in white (#fff). Use Parchment Cream (#ece7db) — it reads as warm light, not a cold screen.
- **Don't** use opacity to dim text. Use the dedicated neutral text tokens (Warm Ember, Shadow Ash). Opacity compounds unpredictably against varied backgrounds.
- **Don't** split rarity tinting rules — every equipment picker, grid item, detail panel, and equipped-slot label uses the same tier → hue mapping.
- **Don't** invent additional elevation layers. The system has three surface tones and three shadow levels. A fourth tone without a role weakens the hierarchy.
- **Don't** use solid borders on disabled controls. Dashed is the established contract.
- **Don't** add a subscription, pricing, or any commerce surface — the game is free, single-player, no monetization.
- **Don't** add decorative looping animations — idle spinners, rotating icons, background parallax, or any motion that cannot be named by what it communicates. The system has no decoration budget.
- **Don't** animate tab switches or panel transitions. Navigation is instant — delaying it reads as lag, not polish.
- **Don't** animate elements that appear and disappear in the normal flow (tooltips, pickers, dropdowns — they appear on interaction and do not need entrance motion). Use the fast tier only for the state change that triggered them.


## Guild Charter Amplification

This is an additive expression layer for the existing **Guild Hall Fire** world, not a replacement palette or a second theme. It is reserved for the app shell, chapter-level hierarchy, primary progression actions, and earned notices. Dense RPG information continues to use the quieter base components above.

**Physical scene:** A guildmaster works from a scarred oak charter desk after dusk. The hall around it is nearly black; hearthlight catches the brass rules, seals, and edges that organize the ledger.

### Material roles

- **Hall Black** (`#0c0a07`): the room beyond the app frame. It deepens Warm Dusk without replacing it inside content.
- **Charred Timber** (`#17120c`): the desktop frame and shell field. A restrained static grain may be built from low-contrast lines; it never moves.
- **Charter Surface / Raised** (`#241b11` / `#302416`): the two working-ledger tones for emphasized controls and framed chapter surfaces.
- **Brass Deep / Lit** (`#6f5723` / `#d8b651`): structural rules and the brighter edge of a selected or primary control. Guild Gold remains the action color; these do not compete with it.
- **Ember and brass washes:** use low-alpha Blazing Sun or Guild Gold over a warm surface to imply reflected firelight. They are material tint, not standalone status colors.

### Heraldic geometry

The charter layer uses **opposed notched corners**: a tight top-left/bottom-right corner paired with a softer top-right/bottom-left corner (typically `3px 11px 3px 11px`, scaling to `4px 18px 4px 18px` for ceremonial controls). Apply this to the shell's important controls, chapter panels, floating notices, and modals—not to every dense data tile. Circles are reserved for coins, wax-seal notices, and impact rings.

Section labels may terminate in a one-pixel brass rule and begin with a small outlined diamond. Active bottom navigation uses one static brass diamond above the selected destination. These are wayfinding marks, never decorative animation.

### Earned feedback

- **Seal strike:** the core Odd Jobs action owns the single authored interaction moment. A thin pressure ring appears at the horizontal press origin while the earned amount rises clear of the label. It completes within `700ms`, uses exponential ease-out, and never loops.
- **Herald notice:** only consequential progression beats—champion level, zone unlock, and forge unlock—receive the enlarged brass notice treatment. A circular line-art seal anchors the message; ordinary operational toasts stay compact.
- **The walk (first run only):** the arrival threshold owns one authored moment, and it spans the whole entry. The camera settles down the lantern road on an exponential ease-out while the title strikes in from wide tracking and out of focus, the beat follows, and the CTA lands last; any input skips to the rest state. Pressing the CTA does not cut — the camera accelerates into the road, the town's hearth blooms up to fill the frame, and a same-document View Transition morphs that bloom into the gold amount in the operating header. The light the player walked toward becomes the first number they play with. This is the only cross-surface transition in the system, and it fires once per save.
- **Additive light, never white:** lantern bloom, window bleed, wet-road reflections, and the hearth are additive sprites over the warm-black scene. Their cores are warm cream, not `#fff`: additive stacking clips red and green first, and a white core leaves the hottest part of a warm scene reading neutral. Brightness during the walk grows by spreading, not by driving alpha to 1.
- **Reduced motion:** `.reduced-motion` and `prefers-reduced-motion` remove seal-strike keyframes while preserving the immediate resource update and all notice content. The walk resolves the same way: the reveal and the bloom are dropped, the scene renders its lit rest state once and stops its ticker, and the CTA navigates instantly on the same tap.

### Responsive rule

At desktop widths the 520px operating column is visibly mounted inside the darker timber field with fine brass side rules. At phone widths the outer frame disappears and the charter becomes full-bleed; touch targets, information density, and the fixed navigation contract do not change.
