---
version: alpha
name: SSU Archives
description: SSU Work Preview Wall
colors:
  background: "#FFFFFF"
  surface: "#F4F3F0"
  surface-strong: "#E6E5E0"
  wall: "#ECEBE7"
  on-background: "#1C1C1A"
  on-surface-muted: "#6F6E69"
  outline: "#DCDBD6"
  outline-strong: "#9E9D97"
  primary: "#1C1C1A"
  on-primary: "#FFFFFF"
  primary-hover: "#3A3A37"
  accent: "#2F5BD3"
  warning: "#B4561C"
  on-warning: "#FFFFFF"
typography:
  title:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.01em
  body:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.2
  caption:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.35
  data:
    fontFamily: Geist Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.35
    fontFeature: tnum
  micro:
    fontFamily: Geist Mono
    fontSize: 9.5px
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: 0.04em
rounded:
  xs: 3px
  sm: 6px
  md: 10px
  lg: 14px
  full: 999px
spacing:
  xxs: 4px
  xs: 6px
  sm: 10px
  md: 14px
  lg: 20px
  xl: 28px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 0 16px
    height: 36px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.on-background}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 0 16px
    height: 36px
  button-secondary-hover:
    backgroundColor: "{colors.surface}"
  button-text:
    backgroundColor: transparent
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 0 10px
    height: 32px
  button-text-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-background}"
  button-icon:
    backgroundColor: transparent
    textColor: "{colors.on-surface-muted}"
    rounded: "{rounded.full}"
    size: 36px
  button-icon-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-background}"
  button-small:
    typography: "{typography.caption}"
    height: 28px
    padding: 0 12px
  button-xsmall:
    typography: "{typography.caption}"
    height: 24px
    padding: 0 8px
  button-danger:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.on-warning}"
  segmented:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: 2px
  segmented-option:
    backgroundColor: transparent
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 0 12px
    height: 28px
  segmented-option-selected:
    backgroundColor: "{colors.background}"
    textColor: "{colors.on-background}"
  filmstrip-item:
    backgroundColor: "{colors.wall}"
    rounded: "{rounded.lg}"
  filmstrip-item-active:
    backgroundColor: "{colors.wall}"
    rounded: "{rounded.lg}"
    height: 530px
  grid-tile:
    backgroundColor: "{colors.wall}"
    rounded: "{rounded.md}"
  grid-caption:
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.micro}"
  lightbox:
    backgroundColor: "{colors.background}"
  lightbox-image:
    backgroundColor: "{colors.wall}"
    rounded: "{rounded.lg}"
  add-card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.on-background}"
    rounded: "{rounded.lg}"
---

# Poster Wall

## Overview

A preview tool that behaves like a blank gallery wall. Everything around the poster is neutral, small and quiet so the artwork carries all the color. Captions and counts read like a contact sheet, not decoration. One accent blue exists only for keyboard focus and drop targets; the primary action is ink-black, like a pen mark on a proof sheet.

## Colors

- **background / surface / surface-strong** are warm whites and greys with a slight yellow bias, like paper and gallery walls. Never pure cool grey.
- **wall** is the mockup's empty state. It must stay visibly different from background so the poster frame reads even with no image.
- **primary** is ink. It is used for the single most important action in view (Log in).
- **accent** is reserved for focus rings and the drag-and-drop outline.
- **warning** marks low dpi, ratio mismatches and an armed delete. It is never used for decoration.

Dark mode mirrors every role: background `#161615`, surface `#22221F`, surface-strong `#2E2E2A`, wall `#1D1D1B`, on-background `#ECEBE6`, on-surface-muted `#9A9993`, outline `#2E2E2B`, outline-strong `#5B5A55`, primary `#ECEBE6`, on-primary `#161615`, primary-hover `#D4D3CD`, accent `#7D9BFF`, warning `#E08A52`.

## Typography

Geist for interface text, Geist Mono for anything that is a measurement or a file name (pixel sizes, counts, poster captions). Poster captions use `micro`: tiny, uppercase, slightly tracked, like labels on a contact sheet. Numbers use tabular figures. There is no display size: the poster is the headline.

## Layout

One column: a Strip / Grid toggle at the top, the current view filling the middle, and a quiet footer (status, count, Admin). There are no size controls; every poster is shown at its own pixel ratio.

**Strip** (default). A ring of posters, vertically centred, sliding past both screen edges. It opens on the first poster uploaded, and with four or more posters it wraps seamlessly (… 30 31 1 2 3 …). The active poster is full size (up to 75% of the stage height and 530px; the widest poster never takes more than half the width, 72% on phones). Sizes step down with distance from it: 46%, 36%, then 30% (42%, 34%, 28% on phones). Gaps are a tight 6px (4px on phones). The active poster's name and pixel size sit in one line below. Navigate by scrolling (one poster per scroll step, wheel or trackpad, either direction), arrow keys, dragging, or clicking a side poster. Clicking the active poster enlarges it.

**Grid.** Every poster at once, in a masonry of 4 columns (3 under 1000px, 2 on phones), max 920px wide, in reading order: each tile drops into the shortest column. Each tile has its file name as a small caption below. Clicking a tile enlarges it. The chosen view is remembered per visitor.

The grid scrolls up behind the Strip / Grid toggle and down behind the footer. Both edges use a progressive blur (five stacked layers, 1px to 14px, each masked to a narrower band toward the edge) plus a light wash of the page colour, so posters soften as they leave the view instead of being cut off. The bands are 66px at the top and 44px at the bottom, and the grid's padding keeps posters at rest clear of them.

**Enlarged view.** A full-screen overlay (background at 94%) shows one poster as large as the window allows, with its name, pixel size, position and a link to the original file below, and a close button in the corner. It grows out of the clicked poster's own position, then swaps in a sharper copy once loaded. Arrow keys move between posters; Escape, the close button or a click anywhere closes it, and the Strip moves to the last poster shown.

**Motion.** All movement uses Motion (`motion/react`) springs (strip: stiffness 210, damping 30; enlarged view: stiffness 280, damping 32). One value, the position in the ring, drives the whole strip; every poster derives its position and scale from it each frame, so movement is pure transform. Only the posters that can be on screen are mounted. A drag moves the whole row under the pointer and the release velocity carries into the spring before it snaps to the nearest poster. There are no fixed-duration CSS transitions on posters. With reduced motion turned on, moves are instant.

**Images.** Posters are delivered through Next.js Image Optimization as WebP, resized to the width they are shown at, never as the original print file. Switching views cross-fades; grid tiles rise in with a short stagger.

## Elevation & Depth

Only the active poster is elevated, with the soft two-layer shadow of a print hanging on a wall. Previews in the strip are flat. Everything else on the page is flat.

## Shapes

Controls are pills (`rounded.full`). Posters and the add card use `rounded.lg` (14px) so they read as objects on the wall.

## Components

- **Buttons** come in four kinds. `button-primary` (filled ink) for the one confirming action in view (Log in). `button-secondary` (outlined) for a second, equal choice. `button-text` for low-emphasis actions such as Admin, Log out, Cancel and Remove. `button-icon` for single-glyph actions. `button-small` and `button-xsmall` are size modifiers for tight rows. `button-danger` is used only for the armed state of Remove.
- Every button shows a hover state, a 2px accent focus ring, and 40% opacity when disabled.
- **segmented** is the Strip / Grid toggle: one grey pill, the selected option white.
- **filmstrip-item** is one poster in the row; **filmstrip-item-active** is the same poster when selected. Corner radius scales with the poster.
- **grid-tile** is one poster in the Grid with a **grid-caption** below.
- **lightbox** / **lightbox-image** make up the enlarged view; the only other control there is a `button-icon` to close.
- **add-card** sits at the end of the strip for the admin only.
- **Remove** needs two clicks: the first arms it (`button-danger`), the second deletes.

## Do's and Don'ts

- Do keep color out of the chrome; let posters supply it.
- Do show measurements and file names in Geist Mono.
- Do use only one `button-primary` in view at a time.
- Don't add shadows to anything except posters.
- Don't animate cards with CSS transitions; use the shared spring.
- Don't use accent blue for buttons or links in body text.