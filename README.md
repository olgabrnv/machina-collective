# MACHINA Collective — Website

A dark, editorial single-page site for MACHINA, a Paris-born hybrid AI creative
collective. Implemented from the Claude Design **v3** prototype as a
self-contained static site — **no build step, no dependencies, no in-browser
transpile.** Open `index.html` and it runs.

## Run locally

```bash
python3 serve.py        # then open http://127.0.0.1:8753
```

(Opening `index.html` directly with `file://` mostly works, but a local server
is recommended so the film and images load reliably.)

## Deploy

It's plain static files — deploy the whole folder to any static host:

```bash
npx vercel deploy --prod      # or: netlify deploy --prod --dir .
```

…or push to a GitHub repo and enable GitHub Pages. No configuration needed; the
app is hash-routed so it works on any static host.

## The pages (hash-routed)

- **Home** (`#/`) — full-bleed muted film loop; the centered MACHINA wordmark is
  a *negative lens* (the film shows photo-inverted, desaturated, inside the
  letterforms); "Paris-born hybrid AI collective" tagline pinned under it.
- **Collective** (`#/collective`) — scroll / drag / arrow-key rolling member
  list; the focused member's work fades in as a dimmed full-color background.
- **Member** (`#/member/:id`) — swipes up on entry; fullscreen media deck with a
  per-project `TYPE / name / year` credit on the right, the artist name centered
  at the bottom, and the bio at the end. Click any work to open the fullscreen
  **player** (restarts with sound; scrubber, mute, close; chrome hides).
- **About** (`#/about`) — studio statement + clients / services / press /
  recognitions.

All interface type uses `mix-blend-mode: difference`, so it inverts against
whatever film or image sits behind it. The top-left wordmark is the home button
on every interior page.

## Structure

```
index.html              entry point
machina3/styles.css     all styles
machina3/app.js         all behavior (router, rolling list, deck, player, chrome)
machina2/data.js        members, bios, galleries, About copy  ← edit content here
machina2/img/           wordmark, poster, gallery stills
machina2/film/          hero film loop (machina-loop.mp4)
machina/image-slot.js   drop-in image placeholder (used for unfilled work)
serve.py                local preview server
```

## Editing content

All copy and media references live in **`machina2/data.js`** (members, roles,
bios, gallery items, About rows). Each gallery item takes:

```js
{ src: "machina2/img/your-still.jpg",   // poster / still
  video: "machina2/film/your-clip.mp4", // optional — enables the deck loop + player
  project: "Project Name", type: "Commercial", year: "2026" }
```

- Add a `video:` to a gallery item and the deck plays it muted on scroll;
  clicking it opens the fullscreen player with sound. Without `video:`, clicking
  a still opens the bundled film loop as a stand-in.
- Ghibli Media's three slots are intentional **placeholders** ("In Production")
  awaiting real films — give them `src`/`video` in `data.js` when ready.

## Notes for a production hardening pass (optional)

- The film (`machina2/film/machina-loop.mp4`, ~19 MB) and several PNG stills are
  large; compress / convert to web formats (WebP/AVIF, a smaller MP4) before a
  public launch.
- The design's live "Tweaks" panel (logo Glass/Negative, wordmark Left/Center,
  Caps/Editorial names, grain) is **not** shipped — the final choices are baked
  in as constants at the top of `machina3/app.js` (Negative logo, Left wordmark,
  Caps names, grain on). Flip them there if needed.
