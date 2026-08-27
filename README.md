# The Bucket v0.7.0-release-candidate


> **Release candidate for the first public web build.**
>
> Runtime configuration is now intentionally JSON-only through
> `game-config.json`. The in-game debug/config menu has been removed from the
> release UI; the only top action left is fullscreen.

Mobile-first procedural ASCII ocean game/prototype built with
**Canvas 2D + JavaScript modules**.

This README consolidates the current project state through the entire
`v0.5.x` cycle and the first `v0.6.x` polish release. The previous
consolidated documentation stopped at `v0.4.19`.

---

## Running the project

Development server:

```bash
npm run dev
```

Default URL:

```text
http://localhost:4173
```

Production build:

```bash
npm run build
npm run preview
```

Do not open `dist/index.html` directly with `file://`; ES modules and
configuration fetches can be restricted by the browser.

---

# Current game loop

The game is built around a bucket that the player pulls out of an ASCII
ocean.

```text
ocean
  ↓
bucket fills underwater
  ↓
player swipes/pulls bucket above surface
  ↓
valid release generates a new ocean seed
  ↓
bucket drains
  ↓
ATTENTION and special emotion cells are processed
  ↓
APETITE / nervous buffers progress
  ↓
larger bucket + creatures + aquarium consequences
  ↓
ENTROPY
  ↓
c:\entity
  ↓
eternal Meltdown
```

---

# Rendering / scene architecture

The playable scene uses several independent canvases/layers:

```text
OceanEngine       ocean + reef + hidden surface extension
AquariumLayer     persistent words + completed-buffer creatures
BucketLayer       bucket + input
HudLayer          ATTENTION / APETITE + c:\nervous>systems
EntropyLayer      fullscreen corruption above gameplay/HUD
Entity overlay    final congratulations terminal
MeltdownLayer     final fullscreen console matrix
```

The important surface invariant is that the water above the viewport is
part of the **same tall ocean canvas**. Pulling the ocean down reveals a
hidden continuation of that scene instead of switching to a second
background.

The project is portrait-mobile-first but remains usable on desktop. The
normal game is centered on desktop; the final Meltdown deliberately
takes over the complete browser viewport.

---

# Ocean / surface

The ocean is a fixed logical character grid rendered with pixel-style
fonts.

Current visual behavior includes:

- procedural reef per seed;
- coral types such as pillar, mound, fan and shelf;
- independently animated algae;
- subtle reef crawlers;
- bubbles / fish / underwater glyph motion;
- hidden upper water extension;
- broken cyan surface reflections;
- continuous water background during small pulls;
- no skyline or separate surface scene.

Reef geometry is intentionally mostly static. Background crawlers and
algae provide most of the environmental motion.

## Surface divider

Since `v0.6.1`, the visual waterline/divider uses **3 glyph rows**
instead of one.

The original gameplay boundary has not moved. The two extra rows are
drawn upward into the surface area, so:

```text
visual thickness  1 row -> 3 rows
swipe height      unchanged
loading geometry  unchanged
```

`OceanEngine.getSurfaceBoundaryWorldRow()` remains the single source of
truth for the bucket's underwater/refresh calculations.

---

# Bucket interaction

The bucket fills only while its reference rim is underwater.

The exact same geometry is used both for:

1. deciding whether loading is allowed;
2. deciding whether the refresh/swipe release is valid.

If the bucket is dragged above the water before releasing:

```text
loading freezes
```

If the player lowers it back underwater while still holding:

```text
loading resumes from the same point
```

A valid refresh requires at least **one fully completed row**.

On a valid release:

- a new ocean seed is generated immediately;
- any incomplete yellow row is discarded;
- completed rows are preserved for draining;
- the ocean returns partway and exposes a small amount of the upper
  surface while `IDLE-SWIPE` drains;
- after draining, the ocean returns completely and a new loading cycle
  begins.

---

# Dynamic bucket size

Bucket capacity ranges from:

```text
1 → 10 rows
```

Capacity `1–3` preserves the original three-row silhouette.

For capacities above `3`, the bucket physically grows downward while
keeping its top/rim anchored, so the refresh geometry does not change.

The capacity used during an active drain is frozen at release time.
Progression changes apply to the next loading cycle.

---

# Progressive filling speed

Filling becomes faster as the bucket grows:

```text
rows 1–3   1.8x
rows 4–6   2.2x
rows 7–9   2.5x
row 10     3.0x
```

Configuration:

```json
{
  "bucketFillSpeedMultiplier": 1.8,
  "bucketFillSpeedAtRows4Multiplier": 2.2,
  "bucketFillSpeedAtRows7Multiplier": 2.5,
  "bucketFillSpeedAtRows10Multiplier": 3.0
}
```

---

# Drain architecture

A drain cycle builds one small timeline when the swipe is accepted.

There are no per-cell timers.

Each cell stores:

```text
row / slot
cell type
start time
duration
end time
```

One animation loop derives visual state from elapsed time. This avoids
callback/timer backlogs and keeps behavior deterministic after skipped
frames.

Normal default drain speed:

```text
7x
```

Special cells currently take:

```text
normal duration × 6
```

---

# Double-tap discard

During `IDLE-SWIPE` / drain, two quick taps discard all remaining cells.

Remaining cells briefly become yellow `X` glyphs before disappearing.

Discarded cells:

- do not grant ATTENTION;
- do not fill nervous buffers;
- do not count as completed onboarding swipes;
- cancel a currently typing nervous terminal signal.

Already-earned rewards from cells drained before the discard remain.

---

# ATTENTION

White cells represent `ATTENTION`.

ATTENTION is awarded only when a white cell is completely removed during
a normal drain.

Default value:

```json
{
  "attentionValuePerCell": 1
}
```

White-cell drain stages:

```text
█ → ▓ → ▒ → ░ → ≡ → empty
```

When the score is earned, small fragments travel toward the ATTENTION
counter in the bottom HUD.

---

# APETITE / progression

The bottom HUD tracks `ATTENTION` and `APETITE`.

Initial bucket:

```text
size 1
```

Bucket `1 → 2` is an onboarding exception:

```text
exactly 2 natural completed swipes
```

Discards do not count.

From bucket `2` onward, progression uses cumulative ATTENTION:

```text
2 → 3   ATTENTION 100
3 → 4   ATTENTION 200
4 → 5   ATTENTION 300
...
9 → 10  ATTENTION 800
```

At bucket `10`, APETITE reaches:

```text
APETITE 0000
```

---

# Special cells / gacha

Cell types:

```text
ATTENTION  white
JOY        yellow
RAGE       red
FEAR       green
GRIEF      blue
```

During row loading **all cells remain yellow**.

The gacha is rolled only when the complete 13-slot row finishes.
Therefore an incomplete row never reveals which future cells would have
been special.

The resolved row is frozen and cannot reroll after configuration or
progression changes.

## Onboarding lock

Special cells are disabled before bucket size `3`:

```json
{
  "gachaUnlockBucketRows": 3
}
```

Bucket sizes `1` and `2` are therefore ATTENTION-only.

## Base special chances

Current defaults:

```text
JOY    5%
RAGE   5%
FEAR   5%
GRIEF  5%
```

ATTENTION receives the remaining probability.

If configured special chances exceed 100%, their relative weights are
normalized into a 100% special pool.

---

# Adaptive emotion gacha

Completed emotion buffers influence future gacha probability.

Same-emotion engagement gets the strongest long-term reinforcement.
Its opposite emotion receives a smaller reinforcement.

Opposite pairs:

```text
JOY  ↔ GRIEF
RAGE ↔ FEAR
```

Long-term defaults:

```json
{
  "gachaAdaptiveOwnBoostPctPerScore": 1.35,
  "gachaAdaptiveOppositeBoostPctPerScore": 0.35,
  "gachaAdaptiveSaturationScore": 12,
  "gachaAdaptiveEmotionChanceCapPct": 30
}
```

The score contribution uses diminishing returns:

```text
effectiveScore = saturation × (1 - exp(-score / saturation))
```

Unrelated emotion chances remain at their base/adaptive value rather
than being directly penalized.

---

# NEW in v0.6.0 — active nervous-buffer gacha feedback

The currently visible colored buffer in `c:\nervous>systems` now also
influences the next bucket rows.

Example:

```text
RAGE buffer is currently filling in red
           ↓
RAGE receives an extra +5 percentage points
on newly completed bucket-row rolls
           ↓
easier to continue filling RAGE
```

Configuration:

```json
{
  "gachaActiveBufferBoostPct": 5
}
```

This is an **additive absolute percentage boost**, not a multiplier.

The boost:

- applies only to the emotion currently shown in the nervous buffer;
- follows the exact display state the player sees;
- disappears when that visible buffer returns to zero;
- switches automatically if another axis becomes the dominant visible
  buffer;
- is still limited by `gachaAdaptiveEmotionChanceCapPct`;
- never bypasses the bucket-1/bucket-2 onboarding lock;
- affects only rows rolled after the state changed, because completed
  rows remain frozen.

This creates a short-term positive-feedback loop on top of the existing
long-term score-based adaptive system.

---

# Nervous system / emotion buffers

`c:\nervous>systems` is the compact terminal in the upper-left corner.

It contains two signed axes:

```text
X axis   JOY +  ↔  GRIEF -
Y axis   RAGE + ↔  FEAR  -
```

A special cell that finishes draining contributes `1` unit to its axis.
The opposite emotion subtracts directly from that same axis and can cross
through zero.

The terminal displays whichever axis has the greatest absolute value.
On exact ties, it preserves the currently displayed axis to avoid visual
flicker.

Default continuous decay:

```json
{
  "nervousBufferDecayPerSecond": 0.05
}
```

## Buffer targets

Initial target:

```text
10
```

Target increases every 10 completed buffers:

```text
score 0–9    target 10
score 10–19  target 20
score 20–29  target 30
...
```

When a target is completed:

- that emotion score increases by `1`;
- its complete axis is consumed/reset to zero;
- the other axis is preserved;
- Aquarium consequences are created.

---

# Nervous terminal signaling

A special emotion is typed into `c:\nervous>systems` when its drain
starts.

The actual nervous-buffer value changes only when that special cell
finishes draining.

Special completion also creates colored fragments that travel toward the
nervous terminal.

During the initial bucket onboarding, the terminal displays:

```text
swipe
```

after the first completed loading row of the first and second bucket-1
cycles. Once bucket size reaches `2`, the onboarding prompt never appears
again.

---

# Aquarium words

Completing nervous buffers creates persistent consequences in a separate
Aquarium layer.

Emotion words:

- are lowercase;
- use translated/emotion-related vocabulary;
- start appearing only after an emotion has at least one completed
  buffer;
- become more frequent as that emotion score increases.

Current baseline:

```json
{
  "aquariumBaseWordsPerMinute": 1.5,
  "aquariumScoreExponent": 0.8,
  "aquariumMaxWords": 32,
  "aquariumWordSpeedCellsPerSecond": 2.2
}
```

The Aquarium layer follows the ocean's pull spatially but its contents are
persistent and are not regenerated when the ocean seed changes.

---

# Procedural Aquarium creatures

Each completed emotional buffer creates exactly **one persistent
creature** in the corresponding emotion color.

Per emotion:

```text
score 1  alpha
score 2  alpha
score 3  beta
score 4  alpha
score 5  alpha
score 6  beta
...
```

In other words, every third creature for the same emotion is a beta
creature.

## Alpha family

Alpha uses the deterministic trigonometric point formula introduced
during the `v0.4.x` Aquarium work.

Default alpha point samples:

```text
900
```

## Beta family

Beta uses the deterministic 10,000-point formula adopted before
`v0.4.19`.

Important rendering invariants:

- exactly 10,000 discrete samples;
- `y = i / 295`;
- fixed logical 400×400 clipping semantics;
- no outlier-based auto-fit;
- uniform geometry;
- natural `4π` / approximately 16-second loop;
- stroke alpha approximately `116 / 255`.

Current beta configuration includes:

```json
{
  "aquariumCreatureBetaPointSamples": 10000,
  "aquariumCreatureBetaScaleMultiplier": 1.28,
  "aquariumCreatureBetaWidthMultiplier": 1.0,
  "aquariumCreatureBetaHeightMultiplier": 1.0,
  "aquariumCreatureBetaSpriteFill": 1.0,
  "aquariumCreatureBetaPointSizeMultiplier": 1.0
}
```

A beta creature also strongly increases the rate at which Aquarium words
are generated.

---

# ENTROPY — final game phase

`v0.5.x` introduced the final phase called **ENTROPY**.

It has two automatic triggers:

```text
1. bucket reaches size 10
2. any emotion reaches completed-buffer score 3
   (the first beta creature for that emotion)
```

A debug button can also start/restart Entropy manually.

## APETITE → ENTROPY transition

The bottom HUD label transforms character-by-character:

```text
APETITE
  ↓ scrambled characters
ENTROPY
```

while its value transitions to:

```text
ENTROPY 1000
```

Once settled, Entropy decreases toward zero.

Default:

```json
{
  "entropyDecayPerSecond": 10
}
```

At the default rate, `1000 → 0` takes approximately 100 seconds.

---

# Entropy glitch layer

The final Entropy visual evolved through several experiments in
`v0.5.x`. The current direction is based on the original `v0.5.0` live
scene-sampling approach.

Important behavior:

- the Entropy layer sits above Ocean, Aquarium, Bucket and HUD;
- glitch regions sample the **current lower-layer image**;
- moving fish/bucket/HUD content therefore glitches live rather than
  becoming frozen textures;
- regions accumulate over time instead of every frame choosing an
  entirely unrelated location;
- region masks use varied sizes and fragmented shapes;
- horizontal bands are present but are no longer the dominant form;
- color-channel accents are restrained;
- corruption becomes denser/faster as Entropy approaches zero.

The visual continues running at maximum corruption while the final
`c:\entity` popup is displayed.

---

# ENTROPY 0000 / player lock

When Entropy reaches zero:

```text
player input ends
```

`BucketLayer.setInputEnabled(false)` disables:

- swipe/pull;
- double-tap discard;
- new bucket interactions.

If the player is physically dragging the ocean when zero is reached, the
gesture is released and the water returns.

---

# c:\entity

At `ENTROPY 0000`, a stable terminal appears in the center of the screen,
above the glitch layer.

Title:

```text
c:\entity
```

Message:

```text
Congratulations! You became a channel through which now communicative capitalism circulates and proliferates.
```

Any tap/click/touch/key closes the terminal and starts the final
Meltdown.

Since `v0.6.2`, the popup height is content-driven: the decorative cursor row
was removed, the old fixed minimum height was removed, and the panel now wraps
closely around the message without leaving an empty line below it.

---

# Real game termination

The input that dismisses `c:\entity` is the actual end of the playable
game.

At that moment the project destroys/stops:

```text
BucketLayer
EntropyLayer
HudLayer
AquariumLayer
OceanEngine
```

Their canvases and debug UI are hidden.

**MeltdownLayer becomes the only continuing animation system.**

---

# Meltdown final

The Meltdown renderer evolved throughout `v0.5.4 → v0.5.10` using the
supplied Meltdown references plus ideas from `MamaMatrix`, `tinymatrix`
and `play.core` examples.

The current implementation is a fixed-coordinate **console matrix**.

## Full viewport

The final canvas uses:

```css
position: fixed;
width: 100vw;
height: 100dvh;
z-index: 9999;
```

so the final animation covers the complete browser viewport instead of
only the portrait game shell.

Matrix cells are derived from the viewport:

```text
cellW = viewportWidth / cols
cellH = viewportHeight / rows
```

Every character is drawn directly at its permanent `(x, y)` console
cell.

## Fixed coordinates

Rows do not physically translate or fall.

The final animation follows the `play.core` model:

```text
coordinate stays fixed
time changes
returned character changes
```

The illusion of flow/melting comes from how every cell samples the text
stream and procedural fields.

## Time field / cascade

The `time_milliseconds` reference inspired the main deformation field:

```text
t = time × 0.0001
o = sin(y × sin(t) × 0.2 + x × 0.04 + t) × 20
```

That field influences:

- spaces between text chunks;
- which text-stream index a cell reads;
- negative-space waves;
- secondary console glyphs.

The strength is activated progressively from the top row toward the
bottom, producing the initial cascade without moving row coordinates.

## Text as material

The final matrix is built from the three supplied messages:

```text
Permanent record of everything you do...
```

```text
...messages become 'mere contributions to the circulation of images, opinions and information, to the billions of nuggets of information and affect trying to catch and hold attention, to push or sway opinion, taste and trends in one direction rather than another.'
```

```text
It doesn't care how many 'anti-capitalist' messages are circulating, only that the circulation of messages continues incessantly.
```

plus small pseudo-code fragments that increase console density.

## Chroma Spiral field

`v0.5.10` added a second field inspired by the `chromaspiral` demo.

It uses:

- normalized matrix coordinates;
- iterative rotation;
- time-dependent sine/cosine offsets;
- density `#Wabc:+-. `;
- color bands.

Its purpose is not to replace the text. It gives the matrix larger,
coherent animated forms so the final screen reads as an evolving shape
rather than only a field of independently changing characters.

Current conceptual combination:

```text
text/messages      = material
time_milliseconds  = cascade / flow
chromaspiral       = large-scale form
```

The Meltdown runs forever.

---

# Release configuration

The release build has **no in-game configuration/debug menu**.

All gameplay and tuning values are loaded from the root:

```text
game-config.json
```

Changing that JSON and rebuilding/redeploying is the supported configuration
workflow for the release candidate.

The only top-right UI action that remains is the fullscreen button.

---

# Important configuration defaults

```json
{
  "bucketLoadingRows": 1,
  "bucketDrainSpeedMultiplier": 7,
  "bucketLoadingSlotDurationMs": 1000,
  "bucketFillSpeedMultiplier": 1.8,
  "bucketFillSpeedAtRows4Multiplier": 2.2,
  "bucketFillSpeedAtRows7Multiplier": 2.5,
  "bucketFillSpeedAtRows10Multiplier": 3.0,

  "attentionValuePerCell": 1,
  "appetiteMultiplier": 100,

  "gachaJoyChancePct": 5,
  "gachaRageChancePct": 5,
  "gachaFearChancePct": 5,
  "gachaGriefChancePct": 5,
  "gachaUnlockBucketRows": 3,

  "gachaAdaptiveOwnBoostPctPerScore": 1.35,
  "gachaAdaptiveOppositeBoostPctPerScore": 0.35,
  "gachaAdaptiveSaturationScore": 12,
  "gachaAdaptiveEmotionChanceCapPct": 30,
  "gachaActiveBufferBoostPct": 5,

  "specialCellDrainDurationMultiplier": 6,
  "nervousBufferDecayPerSecond": 0.05,
  "nervousBufferBaseTarget": 10,
  "nervousBufferScoresPerTargetTier": 10,
  "nervousBufferTargetStep": 10,

  "aquariumCreaturePointSamples": 900,
  "aquariumCreatureBetaPointSamples": 10000,
  "aquariumCreatureSizeViewportRatio": 0.35,

  "entropyDecayPerSecond": 10
}
```

See the root `game-config.json` for the complete authoritative list.

---

# Version history since the previous consolidated README

## v0.4.19

- progressive bucket filling speed (`1.8 / 2.2 / 2.5 / 3.0`);
- stronger long-term same-emotion adaptive gacha (`1.35`);
- 10,000-point beta creature / fixed 400×400 clipping retained.

## v0.5.0

- introduced ENTROPY;
- bucket-10 and emotion-score-3 triggers;
- `APETITE → ENTROPY` scrambled transition;
- `1000 → 0000` countdown;
- initial full-screen glitch layer;
- debug Entropy controls.

## v0.5.1

- experimental persistent grid/colony corruption.

## v0.5.2

- experimental random persistent patches with varied sizes.

## v0.5.3

- returned to the stronger `v0.5.0` glitch direction;
- glitch masks sample the live game underneath;
- persistent spatial masks without painted colored blocks.

## v0.5.4

- `ENTROPY 0000` input lock;
- final `c:\entity` terminal;
- first Meltdown implementation.

## v0.5.5

- more aggressive top-down Meltdown experiments;
- row re-sampling and larger mutations.

## v0.5.6

- dismissing `c:\entity` became the true game termination point;
- Ocean/Aquarium/Bucket/HUD/Entropy loops are destroyed;
- only Meltdown remains alive.

## v0.5.7

- Meltdown redesigned as an endless textual wall;
- MamaMatrix-style horizontal wrap / phase concepts explored.

## v0.5.8

- fixed-coordinate console matrix;
- rows no longer physically move;
- animated text gaps and coordinate-based glyph selection.

## v0.5.9

- Meltdown moved to the complete browser viewport;
- every character rendered cell-by-cell;
- `time_milliseconds` field integrated for the cascade/melting motion.

## v0.5.10

- Chroma Spiral field integrated;
- larger coherent animated forms added to the final console matrix.

## v0.6.0

- documentation consolidated through the complete `v0.5.x` phase;
- active visible nervous buffer now gives its emotion an additional
  gacha chance boost;
- default active-buffer bonus: **+5 percentage points**;
- no new gameplay phase introduced: `v0.6.x` begins as the polish and
  balancing series.


## v0.6.1

- surface/waterline divider increased from 1 to 3 visual glyph rows;
- the two extra divider rows extend upward, preserving the exact swipe
  threshold and underwater loading geometry;
- `gachaActiveBufferBoostPct` reduced from `10` to `5` to slow the
  short-term emotion snowball and make early Entropy less likely.


## v0.6.2

- corrected the final `c:\entity` victory message;
- removed the extra cursor/blank row from the final popup and made its height
  follow the text content;
- corrected clear English typos in the three Meltdown source messages without
  changing their intended meaning.

---

# Web release / GitHub Pages

Repository name:

```text
the-bucket
```

This project is already structured as a static site. The command:

```bash
npm run build
```

creates:

```text
dist/
├── index.html
├── game-config.json
├── favicon.ico
├── favicon-16.png
├── favicon-32.png
├── favicon-48.png
├── apple-touch-icon.png
├── icon-192.png
├── icon-512.png
├── icon-600.png
├── site.webmanifest
└── src/
```

All runtime URLs use relative paths, so the project is compatible with a
GitHub Pages project URL such as:

```text
https://<github-user>.github.io/the-bucket/
```

## First GitHub Pages setup

This release candidate already includes:

```text
.github/workflows/deploy-pages.yml
```

After pushing the project to the `main` branch:

1. Open the `the-bucket` repository on GitHub.
2. Open **Settings**.
3. In the left sidebar, open **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Push/merge the release candidate to `main`, or manually run the
   **Deploy The Bucket to GitHub Pages** workflow from the Actions tab.
6. Open the workflow run and confirm that both `build` and `deploy` completed.
7. GitHub will expose the deployed Pages URL in the `github-pages`
   environment/deployment summary.

The workflow performs:

```text
checkout
  ↓
npm run build
  ↓
upload ./dist as Pages artifact
  ↓
deploy to github-pages
```

## Web metadata included

The release HTML includes:

- `<title>The Bucket</title>`;
- description metadata;
- Open Graph title/description/image metadata;
- Twitter summary metadata;
- `theme-color`;
- Apple web-app metadata;
- `site.webmanifest`;
- favicon sizes `16`, `32`, `48`;
- Apple touch icon `180`;
- installable icons `192` and `512`;
- a `600×600` project/share icon.

The icon files live in:

```text
public/
```

and the build copies them to the root of `dist/`.

Once the final public Pages URL is known, a later release can add an absolute
`canonical`, `og:url`, and absolute `og:image` URL using the real GitHub
username/domain.


---

# Release candidate history


## v0.7.0-release-candidate

- project/repository naming aligned to **The Bucket / `the-bucket`**;
- removed the config/debug menu from the release UI;
- removed the debug-panel runtime implementation;
- `game-config.json` is now the only release configuration surface;
- fullscreen remains as the only top action;
- added favicon, Apple touch icon, installable web icons and a 600×600 icon;
- added web manifest and browser/social metadata;
- build now copies `public/` assets into `dist/`;
- added `.github/workflows/deploy-pages.yml`;
- prepared the static `dist/` output for the first GitHub Pages deployment.
