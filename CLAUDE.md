# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Dead Reckoning** — a static site that lets users navigate the Grateful Dead's entire setlist catalogue by choosing songs one at a time. Each choice filters the pool of ~2,350 shows until a single show is uniquely identified and revealed.

## Commands

**Fetch setlist data** (run once — requires internet, consumes ~120 of 1,440 daily API credits):
```
node scripts/fetch-setlists.js
```
Outputs `data/setlists.json`. Must be re-run if you want fresh data.

**Serve the site locally** (required — `fetch()` won't work over `file://`):
```
npx serve .
```

There is no build step. There are no tests. There are no dependencies to install.

## Architecture

The app is a single HTML page (`index.html`) with no framework and no bundler.

### Data pipeline
`scripts/fetch-setlists.js` → `data/setlists.json` → loaded by `app.js` at runtime via `fetch()`

The fetch script hits the setlist.fm REST API (`/artist/{mbid}/setlists?p={page}`) with the Grateful Dead's MusicBrainz ID `6faa7ca7-0d99-4a5e-bfa6-1fd5037520c6`, paginates through all results at 600ms/request, and writes a JSON array of show objects.

Each show in `setlists.json` has two song representations:
- `songs` — flat ordered array used for prefix matching at runtime
- `sets` — structured `[{ name, songs }]` used only for display in the reveal

### Navigation model
This is a **prefix trie** traversal, not a Markov chain. At each step, `app.js` filters all shows to those whose `songs` array starts with the current `selectedPath`, then counts the distribution of `songs[selectedPath.length]` across matching shows. When only one show remains (or all remaining shows have no more songs), the show is revealed.

Core logic lives in three functions in `app.js`:
- `getMatchingShows()` — filters `allShows` by prefix match against `selectedPath`
- `getNextOptions(shows)` — builds frequency-sorted list of next songs
- `renderState()` — orchestrates all DOM updates based on current state

### State
Two module-level variables: `allShows` (set once on load, never mutated) and `selectedPath` (array of song name strings, mutated by selection/back/restart).

### CSS class contract
`app.js` creates DOM elements and assigns CSS classes directly. If renaming classes in `style.css`, the same names must be updated in `app.js`. Key classes set programmatically: `song-card`, `top`, `song-name`, `song-count`, `path-chip`, `path-chip-num`, `path-arrow`, `found` (on `#counter-number`), `reveal-*` family, `btn-setlist`, `btn-again`, `reveal-separator`, `fade-out`.

## Key files

| File | Purpose |
|---|---|
| `scripts/fetch-setlists.js` | One-time data fetcher — contains the API key, gitignored |
| `data/setlists.json` | Generated setlist database loaded at runtime |
| `app.js` | All application logic — state, filtering, DOM rendering |
| `style.css` | All styles — fonts: Alfa Slab One (title) + Space Grotesk (body) |
| `font-picker.html` | Standalone font comparison page, not part of the app |

## Important constraints

- `scripts/fetch-setlists.js` is gitignored because it contains the API key.
- The API key has a hard limit of **1,440 requests/day**. The full fetch takes ~120 requests.
- `data/setlists.json` is **not** gitignored — it should be committed so the site works without running the fetch script.
