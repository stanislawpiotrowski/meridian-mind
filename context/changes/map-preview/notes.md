# Map colour & projection preview — working notes

Branch: `map-preview` (all work lives here; `master` is untouched).
Status: **DECIDED & inlined — daylight theme + Winkel Tripel projection.** Preview
scaffolding (URL switcher, other themes/projections, ProjectionKind plumbing) has
been removed. Staying on `map-preview` for now; not yet merged to `master`.

## Final decision (2026-06-05)

- **Theme:** `daylight` — light-blue ocean (#dbeafe), ivory land (#fefce8), slate
  borders (#94a3b8) / ink (#1e293b). Inlined as palette constants in `InteractiveMap.tsx`.
- **Projection:** Winkel Tripel (`geoWinkel3` from `d3-geo-projection`) — National
  Geographic's reference world projection, lowest average distortion among the
  compromises evaluated. Set via `DEFAULT_PROJECTION` in `mapProjection.ts`.
- **Projection extension point (kept on purpose):** `mapProjection.ts` exposes a
  small `PROJECTIONS` registry (winkel3 / robinson / natural — the finalists),
  `ProjectionKind`, and `DEFAULT_PROJECTION`. `createMapProjection(…, kind?)` and an
  optional `projection?` prop on `InteractiveMap` thread a choice through. Today
  nothing passes it (Winkel everywhere), so this is NOT preview scaffolding — it's a
  deliberate, low-cost seam:
  - change the global default → edit `DEFAULT_PROJECTION` (one line);
  - add a candidate → import factory + one `PROJECTIONS` entry (+ a line in the
    `d3-geo-projection.d.ts` shim if it comes from that package);
  - future user-selectable projection (settings UI) → feed a stored preference into
    the `projection` prop; no map code changes. Storage decision (localStorage vs
    Supabase per-user) is the only real work then — the map side is done.
- **Kept (real fixes, not scaffolding):** bbox clamp to ±90/±180, densified
  LineString fit/bounds, tight viewBox + inline aspect-ratio so the map fills its
  frame. See the framing notes below.
- **Dependency:** `d3-geo-projection@4.0.0` is now permanent; types via the local
  shim `src/lib/d3-geo-projection.d.ts` (trimmed to just `geoWinkel3`).
- **Still owed before merge:** consider fixing the real root cause in
  `study.ts boundingBox()` (per-axis padding instead of clamping at the projection
  boundary) — separate `master` concern, currently compensated by the clamp.

## Why we started

User feedback: the map looks dark and grey. Two adjustable aspects under review:

1. **Colour scheme** — too dark / too much grey.
2. **Projection** — country shapes look stretched/distorted (equirectangular).
   (Out of scope for now: changing the basemap to physical/topographic/rivers.)

## Key findings (before any change)

- All map colours were hardcoded SVG literals in `InteractiveMap.tsx`. Easy to change.
- The big dark area is the **ocean = the page background** showing through; the SVG had
  no background of its own and countries were filled at only 6% opacity. The real lever
  for "too dark" is giving the SVG its own ocean colour + higher land opacity.
- Projection lives in **one place**: `mapProjection.ts` (`geoEquirectangular()`).
  Swapping it is a one-liner; the rest of the code is projection-agnostic.
- **Distance is independent of projection.** `haversine()` in `geo.ts` works on real
  lat/lng, so changing the projection does NOT affect the km calculation. Only the
  on-screen position of markers/connector changes.

## What we built on this branch (TEMPORARY scaffolding)

A URL-driven preset switcher so every colour theme × projection can be eyeballed on the
**real `/study/<id>` map** without editing code per attempt. No params ⇒ identical to today.

Files changed:

- `src/lib/mapProjection.ts` — `createMapProjection(..., kind)` accepts a `ProjectionKind`
  (`equirectangular` | `natural` | `equal`); added `geoNaturalEarth1`, `geoEqualEarth`.
- `src/components/map/InteractiveMap.tsx` — `THEMES` table + `readPresetFromUrl()`,
  ocean `<rect>`, theme-driven colours for land/border/connector/marker text/distance text.
  Preset read after hydration (useEffect) so SSR matches.

Each change is marked with `PREVIEW SCAFFOLDING` comments for easy removal later.

Themes (`InteractiveMap.tsx`):

- `daylight` — light blue ocean, ivory land, slate borders (light, classic atlas)
- `slate` — light grey ocean, white land (light, minimal)
- `midnight` — navy instead of black, brighter land (stays dark but readable)
- default (no param) — today's exact look (transparent ocean, 6% land fill)

Projections: `equirectangular` (current), `natural` (Natural Earth), `equal`
(Equal Earth), plus the classic world-map compromises `robinson` (Robinson),
`winkel3` (Winkel Tripel — National Geographic's choice), `mollweide`
(Mollweide, equal-area ellipse). The last three come from the `d3-geo-projection`
add-on (newly installed; see cleanup note below).

**Framing fix (2026-06-05):** the SVG viewBox is now derived from each
projection's _tight projected bounds_ (`projection.bounds` in `mapProjection.ts`)
instead of a fixed 2:1 box. This crops the dead margins `fitExtent` used to leave
around non-2:1 projections — the cause of the "tiny map, lots of empty space"
look on the whole-world set. Markers/clicks share the same user-space, so nothing
downstream changed.

**Correction (same day):** the first cut measured `bounds` from `fitExtent`'s
fit object, which for a bbox set was a `MultiPoint` of the 4 corners. For curved
projections (Natural/Robinson/Winkel3/Mollweide) the projected corners are NOT
the map's extent — the edges bow outside them — so the frame came out wrong and
differently per projection (Natural flattened, Robinson/Winkel3 too tall and
clipped). Fixed by making `bboxToGeoObject` a **densified closed LineString ring**
of the bbox edges (d3 resamples line edges along the projection, tracing the true
curved outline); the same object now drives both the fit and the bounds, so they
stay consistent. Sanity check (world-ish bbox) gives sensible width-constrained
aspects 2.0–2.8 across all six projections.

**Root cause found (Natural specifically):** `boundingBox()` in `study.ts` pads by
a fraction of the _larger_ lat/lng span and adds it to _both_ axes without clamping.
A whole-world set (lng span ~350°) gets ~50° of pad on latitude too, so the bbox
runs to ~lat ±100 / lng ±227 — outside the valid ±90 / ±180 range. Equirectangular
just over-frames (empty bands = the very first "map too small" complaint), but
Natural Earth's polynomial diverges past the poles, squishing the real world into a
central sliver while the frame is sized to extrapolated garbage. Fixed by clamping
the framing box to [-180,180]×[-90,90] in `bboxToGeoObject` (projection boundary —
defensive and correct for every projection; this is a real fix, not scaffolding).
After clamping, full-world aspects are the textbook values: natural 1.92, robinson
1.97, winkel3 1.64, mollweide 2.00, equal 2.05.

**Layout correction (2026-06-05, after regression):** an earlier attempt set an
inline `aspect-ratio` on the SVG (matching the bounds) to kill the letterbox. That
overrode the consumers' fixed `aspect-[2/1]` box and made the Winkel map _taller_
than the box — which pushed the Study "Correct/Incorrect" panel below the fold
(layout shift + scroll regression that had previously been fixed). Reverted.

Final approach: keep the consumer's **fixed box aspect** (stable page layout, no
shift when the reveal panel toggles), keep the **tight viewBox**, and paint the
**ocean as the SVG's CSS `backgroundColor`** instead of an in-viewBox `<rect>`.
`preserveAspectRatio="meet"` centres the map; the letterbox margins are now ocean-
coloured, so they read as "more ocean" rather than a frame. This also fixes the
very first complaint (dark frame) for free, since the ocean colour fills the whole
element regardless of projection aspect.

## How to preview (tomorrow)

1. `git checkout map-preview` (if not already on it).
2. `npm run dev` → open the printed localhost URL (was :4322; may differ).
3. Log in, open a set, go to `/study/<id>`, then append query params and refresh:

   | View                         | URL suffix                       |
   | ---------------------------- | -------------------------------- |
   | Original (today)             | _(none)_                         |
   | Daylight + Natural Earth     | `?theme=daylight&proj=natural`   |
   | Slate + Equal Earth          | `?theme=slate&proj=equal`        |
   | Midnight, current projection | `?theme=midnight`                |
   | Projection only              | `?proj=natural` or `?proj=equal` |

   theme = `daylight` | `slate` | `midnight` (omit = current)
   proj = `natural` | `equal` | `robinson` | `winkel3` | `mollweide`
   (omit = current equirectangular)

   Try the new ones on the whole-world set, e.g.:
   `?theme=daylight&proj=robinson`, `?theme=daylight&proj=winkel3`,
   `?theme=daylight&proj=mollweide`.

   Mix freely. The same switcher also affects the landing-page `MapDemo`
   (same component), but evaluate on `/study`.

## How to revert

- Temporarily: remove the URL params → looks like today.
- Fully: `git checkout master` (scaffolding is only on `map-preview`).

## Known caveats to judge during preview

- ~~**viewBox is 2:1**, tuned for equirectangular...~~ **Resolved 2026-06-05** —
  the viewBox now tracks the projection's tight bounds, so every projection fills
  the frame. Judge country shapes _and_ framing freely now.
- Markers/connector/labels adapt colour to the theme so they stay readable on light backgrounds.

## Cleanup owed at decision time (added 2026-06-05)

- `d3-geo-projection@4.0.0` is now a real dependency (for robinson/winkel3/mollweide).
  If the chosen projection is NOT one of those three, `npm uninstall d3-geo-projection`
  and delete `src/lib/d3-geo-projection.d.ts` (the ambient type shim — the package
  ships no types and has no `@types`). If it IS one of them, keep the dep, keep/trim
  the shim, and inline the choice.
- The `projection.bounds` / dynamic-viewBox change is a genuine improvement worth
  keeping regardless of which projection wins — it is NOT preview-only scaffolding.

## Next step when we resume

Pick a "step in the right direction" (a theme and a projection). Then: inline the chosen
values permanently, tune the viewBox aspect for the chosen projection, delete all
`PREVIEW SCAFFOLDING` blocks + the URL reading + the `ProjectionKind` plumbing.

Typecheck status at handoff: `npm run typecheck` → 0 errors.
