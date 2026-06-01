# Skill Base Promo Video Design

**Date:** 2026-04-07

**Goal:** Create a modern launch-style promo animation for Skill Base using real product visuals, brand colors, and the existing logo. The video should be at least 10 seconds long, optimized for a 16:9 release context, and use English copy aligned with `README.md`.

## Product Data And Invariants

This video has four data groups. Keeping them separate avoids turning a short promo into an over-engineered motion system.

### 1. Brand Data

- Product name: `Skill Base`
- Logo source: `web/src/assets/logo.svg`
- Primary accent: `#00FFA3`
- Secondary accent: `#00E592`
- Dark surfaces: `#09090b`, `#13141a`, `#27272a`
- Supporting logo colors: `#41b883`, `#34495e`

### 2. Product Visual Data

- Real web UI screenshots captured from the running app
- Real CLI terminal captures showing `skb` flows
- Optional text fragments derived from `README.md`

### 3. Narrative Data

- Opening problem statement: `Stop stuffing Agent Skills into source repositories.`
- Core product value: distribution, installation, update, and multi-agent compatibility
- Closing CTA-style line: `Publish once. Install anywhere. Update with control.`

### 4. Motion Data

- Fixed composition duration: target `12-14s`
- Output aspect ratio: `1920x1080`
- Scene order is fixed and linear
- Each scene carries one primary message only

## Scene Structure

The video is a single forward sequence, not a menu of features.

1. **Brand Intro** (`0.0s - 1.8s`)
   - Logo assemble / reveal
   - Large headline and problem framing
   - Background hints at `.cursor`, `.claude`, `.agents`, `skills`

2. **Web UI Proof** (`1.8s - 5.0s`)
   - Real product interface shown in a framed hero layout
   - Search, listing, and detail/publish affordances highlighted
   - Purpose: establish trust fast

3. **CLI Flow** (`5.0s - 8.0s`)
   - Real terminal commands and outputs
   - Focus on `search`, `install`, `update`, and/or `publish`
   - Purpose: show practical team workflow

4. **Cross-Agent Distribution** (`8.0s - 10.8s`)
   - Visualize one skill base feeding multiple agent targets
   - Mention Cursor / Claude Code / Copilot / Windsurf / Qoder / similar targets
   - Purpose: differentiate Skill Base from plain file sync

5. **Brand Outro** (`10.8s - 13.0s`)
   - Quick flashback of previous scenes
   - Final logo lockup
   - Closing copy and hold frame for thumbnail extraction

## Visual Language

- Use dark backgrounds with controlled neon-green highlights
- Treat screenshots as first-class content, not background decoration
- Prefer crisp masks, wipes, zooms, and highlight sweeps over particle noise
- Use large English headlines and short supporting lines
- Preserve enough whitespace so the video reads like a product launch, not a dashboard tutorial

## Asset Strategy

### Required Assets

- `web/src/assets/logo.svg`
- At least 2 real web screenshots
- At least 2 real CLI captures

### Capture Strategy

- Run the local app and capture screenshots from real screens
- Capture CLI output from the real `skb` commands used in this repository
- Store reusable assets inside a dedicated promo workspace so rendering is deterministic

## Implementation Architecture

The implementation should stay brutally simple:

- A dedicated `promo-video/` Remotion workspace
- One main composition for the launch reel
- Small scene components with explicit props
- One shared theme file for colors, spacing, and typography
- One timeline data file that defines copy, durations, and asset references

Do not build a generic animation engine. This is one launch reel, not a video SaaS.

## Error Handling And Failure Modes

- Missing screenshots should fail clearly during render with a known asset path
- Scene timing must be centralized so duration changes do not require editing five components by hand
- Captured assets should use stable filenames to avoid broken imports after recapture

## Testing And Validation

- Type-check and build the Remotion workspace
- Render a preview video locally
- Verify final duration is at least 10 seconds
- Verify the final video includes real logo, real screenshots, and brand accent colors
- Spot-check that text remains readable on a 16:9 frame

## Scope Boundaries

Included:

- One polished 16:9 promo reel
- Real product screenshots and CLI captures
- English launch copy derived from existing product messaging

Excluded:

- Voiceover
- Subtitle system
- Multi-format exports like 9:16 or 1:1
- A generalized internal motion graphics toolkit
