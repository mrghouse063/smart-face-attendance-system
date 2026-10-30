---
name: Smart Attendance System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#006329'
  on-tertiary: '#ffffff'
  tertiary-container: '#007f36'
  on-tertiary-container: '#c7ffca'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#7ffc97'
  tertiary-fixed-dim: '#62df7d'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005320'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: Inter
    fontSize: 3rem
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: '1.25'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: '1.35'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: '1.45'
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: '1.25'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  timestamp-lg:
    fontFamily: Inter
    fontSize: 2.25rem
    fontWeight: '700'
    lineHeight: '1.15'
    letterSpacing: -0.02em
  timestamp-md:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1.5rem
  gutter-desktop: 2rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies high-assurance operational efficiency, biometric precision, and workplace transparency. Built primarily for enterprise mobile terminals, tablet kiosks, and employee self-service smartphones, the interface must project effortless speed, authoritative feedback, and uncompromising reliability. 

### Design Philosophy
- **Aesthetic Direction**: Corporate Modern infused with precise biometric instrumentation. The aesthetic merges the clarity of clinical utility with warm, friction-free employee workflows.
- **Visual Tenor**: Calm, controlled, and low-latency. Visual density remains deliberately low during active face recognition scans to preserve camera viewport clarity, expanding into structured, high-density data representations for administrative audits.
- **Emotional Impact**: Instills confidence during touch-free interactions, eliminates ambiguity regarding shift punches, and provides clear, immediate operational feedback.

## Colors

The palette is engineered for rapid visual orientation and unambiguous validation under varied lighting conditions (e.g., bright outdoor lobbies, dimmed turnstiles, and mobile edge environments).

### Roles & Semantic Assignment
- **Primary (`#2563EB`)**: Drives system navigational affordances, primary buttons, interactive controls, and biometric capture triggers.
- **Secondary (`#0F172A`)**: Represents structural authority—used for high-priority typography, scanner overlays, navigation frames, and high-emphasis containers.
- **Semantic Green (`#16A34A` / `#22C55E`)**: Biometric match verified, "Clocked IN" status confirmation, battery/network optimal state, and operational success.
- **Semantic Red (`#DC2626` / `#EF4444`)**: Face mismatch, "Clocked OUT" status confirmation, geofence mismatch, and critical administrative flags.
- **Warning Amber (`#D97706`)**: Low confidence face matches, spoof attempts, sync retries, or offline-cached punch records.
- **Neutral Scales (`#F8FAFC`, `#F1F5F9`, `#E2E8F0`, `#64748B`)**: Structural canvas backgrounds, subtle card outlines, metadata, and inactive elements.

## Typography

The typographic hierarchy uses **Inter** across all touchpoints. Its tall x-height, clear letterforms, and extensive OpenType feature set ensure rapid recognition in quick verification scenarios.

### OpenType & Numeric Presentation
- **Tabular Figures (`tnum`)**: Mandatory for all live clocks, shift timestamps, verification latency indicators, and employee counters. Prevents layout jitter during continuous real-time scanning.
- **Slashed Zero (`zero`)**: Enabled on audit logs and employee employee identification codes to differentiate numerals from alphabetical characters.
- **Labels & Microcopy**: Small headers (`label-sm`) must use uppercase transforms with wide tracking (`0.05em`) for swift status scanning.

## Layout & Spacing

A strictly disciplined 4px/8px incremental spatial rhythm governs all viewports, ensuring predictable vertical alignment across device profiles.

### Layout Mechanics
- **Mobile Handheld (360px – 599px)**: Single-column fluid stack. Touch-first actions anchored within an ergonomic bottom thumb-zone (64px bottom clearance).
- **Kiosk / Tablet (600px – 1023px)**: Split-pane viewport architecture. Camera reticle occupies 55% of the screen area on the primary side, while live roster feeds and recent scan verification cards populate the complementary side.
- **Admin Desktop (1024px+)**: 12-column layout grid with a fixed 260px administrative navigation rail, accommodating wide timecard tables and dense analytics panels.

## Elevation & Depth

Visual hierarchy uses clean tonal planes, fine borders, and calibrated ambient shadows, preventing heavy skeuomorphic distractions during video ingestion.

### Elevation Levels
- **Level 0 (Base Canvas)**: Flat `#F8FAFC`. Zero elevation. Houses the primary dashboard grids, historical tables, and base backgrounds.
- **Level 1 (Cards, Metric Tiles, Table Rows)**: Surface `#FFFFFF` layered with a crisp outline (`1px solid #E2E8F0`) and an ambient shadow (`box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`).
- **Level 2 (Interactive Floating Actions, Dropdowns, Hovered Rows)**: Raised surface with pronounced ambient diffusion (`box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`).
- **Level 3 (Modal Dialogs, Reticle Confirmation Sheets, Overlays)**: Surface `#FFFFFF` backed by `rgba(15, 23, 42, 0.65)` backdrop scrim, accompanied by deep floating elevation (`box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)`).

## Shapes

The interface balances sharp industrial geometry with human-centric rounded corners. Standard elements adopt an 8px radius (`roundedness: 2`), ensuring a contemporary, clean look.

### Shape Hierarchy
- **Base Components (Inputs, Buttons, Cards)**: `0.5rem` (8px). Delivers a crisp, modern corner profile.
- **Containers & Modal Shells**: `1rem` (16px, `rounded-lg`). Softens large boundaries on tablet kiosks and desktop monitors.
- **Status Pills & Action Floating Buttons**: Full pill radius (`9999px`) for state indicators, status tags, and primary clocking switches.
- **Biometric Target Viewport**: An elliptical or rounded rectangle container (`1.5rem` / 24px corner radius) defined by bounding brackets rather than hard boxed borders.

## Components

### 1. Biometric Camera Reticle & Target Frame
- **Construction**: Centered within the scan container with an aspect ratio of 3:4.
- **Target Reticle**: An inner oval or rounded bracket frame with a 2px semi-transparent white/slate border (`rgba(255, 255, 255, 0.6)` on live feed).
- **State Feedback**:
  - *Searching / Detecting*: Thin neutral slate brackets with a gentle, ambient 1.5s pulse.
  - *Analyzing*: Active `#2563EB` border with a subtle top-to-bottom scanning beam.
  - *Confirmed (IN)*: Instant shift to a 3px `#16A34A` solid frame with a matching icon badge and haptic response.
  - *Rejected / Unrecognized*: Instant shift to a 3px `#DC2626` solid frame with micro-shake animation.

### 2. Buttons & Touch Controls
- **Touch Target**: Strict minimum height of 48px (exceeding standard 44px thresholds) to guarantee mis-tap immunity in fast walk-by kiosk environments.
- **Primary Button**: Deep blue `#2563EB` background, `#FFFFFF` text, 8px border radius, bold typography.
- **Semantic Quick-Punches**:
  - *Clock IN*: High-confidence green `#16A34A` background with white typography.
  - *Clock OUT*: Authoritative red `#DC2626` background with white typography.
- **Disabled State**: `#E2E8F0` background with `#94A3B8` text.

### 3. Verification Feedback Panels & Modals
- High-contrast, slide-up confirmation cards appearing within 200ms of recognition.
- Displays employee avatar (48px rounded-full), verified full name, precise tabular timestamp (`HH:mm:ss`), and a prominent semantic pill tag: "CLOCK-IN RECORDED".
- Auto-dismisses after a 2.5-second hold to reset the terminal for the next employee.

### 4. Status Badges & Pills
- **Style**: 24px height, full pill shape (`rounded-full`), padded `space-xs` vertically and `space-sm` horizontally.
- **Tone Pairing**:
  - *IN*: `#DCFCE7` background, `#166534` text, with a `#22C55E` leading indicator dot.
  - *OUT*: `#FEE2E2` background, `#991B1B` text, with a `#EF4444` leading indicator dot.
  - *FLAGGED / RETRY*: `#FEF3C7` background, `#92400E` text.

### 5. Inputs & Filter Fields
- Clean `#FFFFFF` fill with `1px solid #CBD5E1` border.
- 48px height for search fields and drop-downs.
- Focus ring: `2px solid #2563EB` with an offset of 2px.

### 6. Admin Data Tables & Shift Cards
- Alternating subtle row hover (`#F8FAFC`).
- Sticky table headers with uppercase `label-sm` slate text on `#F1F5F9` background.
- Tabular figures for time entries, overtime badges, and match confidence scores (e.g., "99.4%").