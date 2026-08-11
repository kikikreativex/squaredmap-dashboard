# Kiki Kreative — Client Dashboards

One small website that shows each client a live, branded view of their socials:
what's **scheduled**, what's **in progress**, and how their **followers** are doing.
Data comes from **Metricool** (scheduled posts) and **Notion** (ideas board +
follower history). Clients just open a link — no login, no Notion account.

**One site serves every client.** Each client is a row in [`clients.js`](clients.js),
and the client is chosen by the web address:

```
https://<your-site>/?client=squaredmap
https://<your-site>/?client=skinformulas
```

---

## Part 1 — For Ceelin (no code needed)

### How to add a new client

You'll do three quick things: set the client up in Notion, add one block to a
file on GitHub, and (first time only) share the Notion page. Step by step:

1. **In Notion** — create the client's "Content & Socials Hub" page with its three
   databases (Ideas & WIP, Scheduled Posts, Platform Snapshot), the same as
   existing clients. Turn on **Share → Share to web**, and connect the Kiki
   integration via the page's **•••  → Connections**. (This is the same setup
   the existing clients already have.)

2. **On GitHub** — open `clients.js`, click the pencil ✏️ to edit, copy an
   existing client block, and fill in the new client's details:
   - a **slug** (the short name in the web address, e.g. `bourkes`)
   - the client's **Metricool blogId**
   - the three **Notion database IDs**
   - the **networks** they're on (e.g. Instagram, Facebook, TikTok)
   - their **logo** image links
   Then **Commit changes**. Netlify rebuilds automatically in ~1 minute.

3. **Share the link**: `https://<your-site>/?client=<slug>`

That's it — no keys to touch. All clients share the same Metricool and Notion
keys, which are set once (see Part 2).

### "Something isn't loading"

Each tab shows a friendly message if it can't load. The usual causes:
- The Notion integration isn't connected to that client's hub page (step 1).
- A database ID in `clients.js` has a typo.
- The shared keys need re-checking in Netlify (Part 2).

---

## Part 2 — For a developer

### What this is

- **Static frontend** in `public/` (`index.html` + `app.js`, plain JS, Chart.js
  from CDN). No build step.
- **Three serverless functions** in `netlify/functions/` (Netlify Functions v2,
  Node 18+, built-in `fetch`, no npm dependencies):
  - `scheduled.js` → `GET /api/scheduled?client=<slug>&days=<n>` — proxies
    Metricool, returns only not-yet-published post placements.
  - `notion.js` → `GET /api/notion?client=<slug>&source=<ideas|scheduled|snapshot>`
    — proxies a Notion data-source query and flattens the properties.
  - `config.js` → `GET /api/config?client=<slug>` — returns the public-safe
    client config the browser needs (name, networks, logos).
- **`clients.js`** — the single source of truth mapping each slug to its
  Metricool blogId, Notion data-source IDs, networks and logos. Imported by the
  functions (and by the daily sync job). Non-secret, committed to the repo.

### Secrets

Three shared env vars only (see [`.env.example`](.env.example)):
`METRICOOL_TOKEN`, `METRICOOL_USER_ID`, `NOTION_TOKEN`. Set them in Netlify →
Site settings → Environment variables. They never reach the browser — the
functions hold them server-side.

### API contracts

`/api/scheduled` → `{ client, count, posts: [{ network, text, date, media, draft, status }] }`
One row per not-yet-published network placement. Metricool returns everything in
the date window regardless of status, so the function keeps only providers whose
status is **not** `PUBLISHED`/`ERROR`.

`/api/notion` → `{ client, source, count, rows: [ {flattened properties} ] }`
Pages through all results (the snapshot log grows daily). Uses the
`Notion-Version: 2025-09-03` data-sources API — not the older `/v1/databases/:id/query`.

`/api/config` → `{ slug, name, networks, logos }` — no internal IDs.

### Notes / limits

- Analytics come from **Notion's Platform Snapshot history log**, not live from
  Metricool — the site reads follower trends there. A separate daily job writes
  today's numbers into that log (see the sync job, added separately). The header
  says "Platform stats refresh daily" to be honest about this.
- The client slug is read from `?client=` (primary) or the first path segment.
  Default is `squaredmap`.

### Local dev

```bash
npm i -g netlify-cli
cp .env.example .env   # fill in the three secrets
netlify dev            # serves public/ + functions at http://localhost:8888
```
Then open `http://localhost:8888/?client=skinformulas`.

---

## Part 3 — The daily sync job

A GitHub Action ([`.github/workflows/daily-sync.yml`](.github/workflows/daily-sync.yml))
runs [`scripts/sync.mjs`](scripts/sync.mjs) once a day. It replaces the old
Cowork prompt-task with real code, and loops over **every** client in
`clients.js`. For each client it:

1. **Upserts scheduled posts** — pulls Metricool's upcoming posts and writes them
   into the Notion "Scheduled Posts" DB, matched by **Metricool ID** so re-runs
   never create duplicates. Posts that have since published are flipped to
   `Posted`.
2. **Appends the platform snapshot** — writes today's follower count + 30-day
   change as one row per platform (updates today's row if it already exists, so
   re-running the same day is safe).
3. **Refreshes the hub-page callout** — rewrites the "📌 Snapshot" block with the
   last-refreshed date, posts due this week, items in progress, and follower
   totals.

Each step is **independent and non-fatal**: if one fails it's logged and the
others continue; if one client errors, the rest still run.

### Setup

In the GitHub repo → **Settings → Secrets and variables → Actions**, add the same
three secrets as Netlify: `METRICOOL_TOKEN`, `METRICOOL_USER_ID`, `NOTION_TOKEN`.
The Action needs no `npm install` (built-in `fetch`, zero dependencies). Run it
by hand anytime from the **Actions** tab ("Run workflow") — optionally for a
single client slug.

```bash
# run locally the same way the Action does:
node scripts/sync.mjs              # all clients
node scripts/sync.mjs skinformulas # just one
```

### ⚠️ The one thing to verify on the first run

Metricool's **follower analytics endpoint is undocumented**. `scripts/lib/metricool.mjs`
(`getFollowers`) targets the Data Studio datasets endpoint with the follower
field IDs, but the exact URL/shape can't be confirmed without a live token. On
the first run, watch the Action log:

- `snapshot: Instagram 24060, ...` → it works, nothing to do.
- `snapshot FAILED (analytics endpoint): ...` → the endpoint needs adjusting.
  Fix it in **one place** without touching code by setting a
  `METRICOOL_ANALYTICS_URL` env var/secret to the correct base URL, or tweak the
  request in `getFollowers`. Meanwhile the job still upserts posts and refreshes
  the callout using the **last logged** follower numbers, so nothing breaks.

Steps 1 (posts) and 3 (callout) use stable, documented REST and should just work.

