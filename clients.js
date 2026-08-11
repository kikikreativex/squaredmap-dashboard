// -----------------------------------------------------------------------------
// clients.js — the ONE place that defines every client dashboard.
//
// To add a new client, copy an existing block, give it a new slug (the key),
// and fill in the six things it needs:
//   1. name              — how the client's name is shown on the page
//   2. metricoolBlogId    — the client's Metricool "blogId"
//   3. notion.ideas       — Notion data-source ID for the Ideas & WIP database
//   4. notion.scheduled   — Notion data-source ID for the Scheduled Posts database
//   5. notion.snapshot    — Notion data-source ID for the Platform Snapshot database
//   6. networks           — the social networks this client is actually on
//                           (order = the order shown on the Platforms tab)
//   + logos               — image URLs for the agency + client badges
//
// The slug (the key, e.g. "skinformulas") is what appears in the dashboard URL:
//   https://<your-site>/?client=skinformulas
//
// SECRETS DO NOT LIVE HERE. The Metricool token, Metricool userId and Notion
// token are shared across all clients and live in environment variables on the
// host (see .env.example). This file only holds non-secret IDs and public logos,
// so it is safe to commit to the repo.
//
// This is a plain ES module (not JSON) on purpose: it imports reliably into both
// the Netlify functions and the daily sync job without any bundler/file-path
// surprises.
// -----------------------------------------------------------------------------

export const CLIENTS = {
  squaredmap: {
    name: "SquaredMap",
    theme: "brand", // original pink/purple look
    metricoolBlogId: "6308701",
    notion: {
      hubPage: "3b3e3d0005c0819998a7f88f96e05309",
      ideas: "70b6e248-e00a-4ee8-9b1c-a49428038650",
      scheduled: "5f560975-92ee-4468-afae-ccd4844a1d29",
      snapshot: "525aa79f-8e7d-4289-b292-66019be3d250",
    },
    networks: ["Instagram", "Facebook", "LinkedIn", "TikTok"],
    logos: {
      agency:
        "https://static.metricool.com/brand-logo/202606/6348619-file-17565444160224945480.jpeg",
      client:
        "https://static.metricool.com/brand-logo/202605/6308701-file-14553394860060422624.jpeg",
    },
  },

  skinformulas: {
    name: "Skin Formulas",
    theme: "mono", // black & white look
    metricoolBlogId: "6346904",
    notion: {
      hubPage: "3b4e3d0005c081ed9921f8c41bbaf38d",
      ideas: "4163760b-bc9d-4e65-b879-cedff9a57008",
      scheduled: "5389304a-1265-4739-9759-bec676748053",
      snapshot: "75bc64ca-e899-4804-a654-8973cac105b1",
    },
    networks: ["Instagram", "Facebook", "TikTok"],
    logos: {
      agency:
        "https://static.metricool.com/brand-logo/202606/6348619-file-17565444160224945480.jpeg",
      client:
        "https://static.metricool.com/brand-logo/202606/6346904-file-17315394846096726012.jpeg",
    },
  },
};

// Look up a client by slug. Returns undefined if the slug is unknown.
export function getClient(slug) {
  if (!slug) return undefined;
  return CLIENTS[String(slug).toLowerCase().trim()];
}

// The public-safe subset the browser is allowed to see (no internal IDs).
export function publicConfig(slug) {
  const c = getClient(slug);
  if (!c) return undefined;
  return {
    slug: String(slug).toLowerCase().trim(),
    name: c.name,
    theme: c.theme || "mono",
    networks: c.networks,
    logos: c.logos,
  };
}
