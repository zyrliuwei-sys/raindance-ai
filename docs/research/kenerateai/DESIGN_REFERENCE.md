# Kenerate AI design reference for Everygen AI

## Extracted foundation

- Reference URL: <https://kenerateai.com/>.
- Fonts: Google Sans for headings; Inter for body. Some decorative Playfair Display italic faces are loaded. The closest local implementation may use the project's existing typefaces if it preserves the bold, tight headline geometry.
- CSS variables: `--background: #fff`, `--foreground: #09090b`, `--primary: #3b82f6`, `--muted: #f4f4f5`, `--border: #e4e4e7`.
- Standard content width: about 1152 px; desktop section padding about 96 px vertically. Header 41 px announcement plus 64 px nav.
- Hero heading: 67.2 px, 700, line-height 68.5 px and slight negative tracking on desktop; 41.6 px on mobile. Body copy approximately 18 px with generous line height.
- Hero form: rounded tab rail above a white bordered rounded text-entry card; large blue Generate button; smaller suggestion chips and example categories below.
- Hero work wall: staggered three-column photographic tiles, varied heights, rounded ~20 px corners, image captions in small white type on dark image scrim.
- Surface character: white space, barely visible cool radial wash, tiny dot grid, tinted alternating section backgrounds, thin cool gray borders, rounded pills.

## Suggested dusk translation

Keep the strong hierarchy, two-column hero, generous breathing room, interactive prompt card and scrolling proof gallery. Translate cool blue to burnt amber / terracotta with dark plum shadows; use warm cream instead of stark white, and dusk sea photography instead of reference media. Make the input interaction an upload-first single-photo MV creator. The result gallery can retain the reference's staggered wall and rounded captions while showing Golden Hour, Seaside Pier, Ocean Breeze and Vintage Film moods.

## Captures

- `docs/design-references/kenerateai/desktop-hero.png`
- `docs/design-references/kenerateai/desktop-full.png`
- `docs/design-references/kenerateai/mobile-hero.png`
- `docs/design-references/kenerateai/mobile-full.png`
- `docs/design-references/kenerateai/mobile-menu.png`

`extraction.json` includes section positions, heading computed styles and reference media URLs. `mobile-extraction.json` records mobile heading dimensions.
