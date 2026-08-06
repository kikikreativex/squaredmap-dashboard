// Destination in your repo: netlify/functions/notion.js
//
// Proxies queries to the two Notion data sources that feed the dashboard
// (the same ones the Notion board and the daily refresh task already use).
// Requires this environment variable in your Netlify site settings:
//   NOTION_TOKEN - a Notion internal integration secret, shared with both
//                    the "Content Ideas & WIP" and "Platform Snapshot"
//                    databases inside the SquaredMap hub page.

const DATA_SOURCES = {
  ideas: "70b6e248-e00a-4ee8-9b1c-a49428038650",
  snapshot: "525aa79f-8e7d-4289-b292-66019be3d250"
};

export default async (req) => {
  try {
    const url = new URL(req.url);
    const source = url.searchParams.get("source");
    const dataSourceId = DATA_SOURCES[source];
    if (!dataSourceId) {
      return new Response(JSON.stringify({ error: "Unknown source. Use ?source=ideas or ?source=snapshot" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const resp = await fetch(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": "2025-09-03",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ page_size: 100 })
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ error: `Notion ${resp.status}: ${text.slice(0, 300)}` }), {
        status: resp.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await resp.json();
    const rows = (data.results || []).map((page) => flattenProperties(page.properties));

    return new Response(JSON.stringify({ rows }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=120" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err && err.message ? err.message : err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

function flattenProperties(props) {
  const out = {};
  for (const key of Object.keys(props || {})) {
    const val = props[key];
    if (!val) continue;
    switch (val.type) {
      case "title":
        out[key] = (val.title || []).map((t) => t.plain_text).join("");
        break;
      case "rich_text":
        out[key] = (val.rich_text || []).map((t) => t.plain_text).join("");
        break;
      case "select":
        out[key] = val.select ? val.select.name : null;
        break;
      case "multi_select":
        out[key] = (val.multi_select || []).map((o) => o.name);
        break;
      case "date":
        out[key] = val.date ? val.date.start : null;
        break;
      case "number":
        out[key] = val.number;
        break;
      case "checkbox":
        out[key] = val.checkbox;
        break;
      default:
        break;
    }
  }
  return out;
}

export const config = { path: "/api/notion" };
