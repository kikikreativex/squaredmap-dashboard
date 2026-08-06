# SquaredMap dashboard — setup guide

This is the coded version of the client portal: a real site with its own URL,
hosted for free, refreshing live from Metricool and Notion. No Claude account
needed for SquaredMap to view it.

## What you downloaded

Five files, named with a `squaredmap-` prefix so they don't collide with
anything else in your downloads. They need to be renamed and placed into a
specific folder structure — the mapping is below.

| File you downloaded | Where it goes in your project |
| --- | --- |
| `squaredmap-index.html` | `index.html` (repo root) |
| `squaredmap-app.js` | `app.js` (repo root) |
| `squaredmap-netlify-toml.txt` | `netlify.toml` (repo root — note the extension change) |
| `squaredmap-fn-scheduled.js` | `netlify/functions/scheduled.js` |
| `squaredmap-fn-notion.js` | `netlify/functions/notion.js` |

So the final folder structure looks like:

```
your-project/
  index.html
  app.js
  netlify.toml
  netlify/
    functions/
      scheduled.js
      notion.js
```

## Step 1 — Create a GitHub repository (~5 min)

1. Go to github.com and sign up for a free account if you don't have one.
2. Click "New repository", name it `squaredmap-dashboard`, keep it Public or
   Private (either works), and create it.
3. Use the "Add file" → "Upload files" button in the repo to upload the files
   above — GitHub lets you drag and drop, and you can type a folder path
   (like `netlify/functions/scheduled.js`) directly into the filename box
   when uploading, which creates the folders for you. No command line needed.

## Step 2 — Get your Metricool API key (~5 min)

1. In Metricool, go to your account settings, find the "API" section.
2. Copy your **userToken** and your **userId**.
3. The **blogId** for SquaredMap is `6308701` (already in the code) — you can
   confirm it by opening the SquaredMap brand in Metricool and checking the
   number in the browser URL.

## Step 3 — Get a Notion integration token (~10 min)

1. Go to notion.so/my-integrations and click "New integration".
2. Name it anything (e.g. "SquaredMap Dashboard"), select your workspace,
   create it, then copy the "Internal Integration Secret" — this is your
   `NOTION_TOKEN`.
3. Open the SquaredMap hub page in Notion, click the "..." menu → "Connections"
   (or "Add connections") → select the integration you just created. Do this
   for the hub page itself, which will share access to the databases nested
   under it (Content Ideas & WIP, Platform Snapshot).

## Step 4 — Deploy on Netlify (~10 min)

1. Go to netlify.com and sign up free (you can sign up directly with your
   GitHub account, which makes the next step one click).
2. Click "Add new site" → "Import an existing project" → choose GitHub →
   select the `squaredmap-dashboard` repo.
3. Leave the build settings as-is (no build command needed) and deploy.
4. Once deployed, go to Site settings → Environment variables and add:
   - `METRICOOL_TOKEN` = your userToken from Step 2
   - `METRICOOL_USER_ID` = your userId from Step 2
   - `METRICOOL_BLOG_ID` = `6308701`
   - `NOTION_TOKEN` = your integration secret from Step 3
5. Go to the "Deploys" tab and trigger "Trigger deploy" → "Deploy site" once
   more so the new environment variables take effect.
6. Netlify gives you a free URL like `squaredmap-dashboard.netlify.app` —
   that's the link you send SquaredMap. You can later add a custom domain if
   you want, from the same site settings.

## What's live vs. daily-refreshed

- **Schedule** tab: fully live, straight from Metricool every time the page loads.
- **Ideas & WIP** tab: fully live, straight from Notion every time the page loads.
- **Platforms** tab: reads from the same "Platform Snapshot" history in Notion
  that the daily scheduled task already fills in — so it's accurate as of the
  last daily refresh, not instant-live. Metricool's own follower/reach API
  turned out to be undocumented and not safe to build directly against, so
  reusing the Notion snapshot (already fed by a supported path) was the more
  reliable choice.

## If something breaks

Each API function returns a plain-English error message inside the dashboard
if a key is missing or wrong (e.g. "Metricool 401: ..."). That message tells
you which key to double check. Send me the exact message and I'll help you
fix it.
