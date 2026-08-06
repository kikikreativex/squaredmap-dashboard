// Destination in your repo: netlify/functions/scheduled.js
export default async (req) => {
  try {
    const url = new URL(req.url);
    const days = Number(url.searchParams.get("days") || "60");

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + days * 86400000);
    end.setHours(23, 59, 59, 0);

    const params = new URLSearchParams({
      blogId: process.env.METRICOOL_BLOG_ID,
      userId: process.env.METRICOOL_USER_ID,
      start: start.toISOString().slice(0, 19),
      end: end.toISOString().slice(0, 19),
      timezone: "Europe/Dublin"
    });

    const resp = await fetch(`https://app.metricool.com/api/v2/scheduler/posts?${params.toString()}`, {
      headers: { "X-Mc-Auth": process.env.METRICOOL_TOKEN }
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ error: `Metricool ${resp.status}: ${text.slice(0, 300)}` }), {
        status: resp.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await resp.json();
    const raw = Array.isArray(data) ? data : (data.data || []);

    const posts = raw.map((p) => {
      const provider = Array.isArray(p.providers) && p.providers[0] ? p.providers[0] : {};
      const media = Array.isArray(p.media) && p.media.length ? p.media[0] : null;
      return {
        id: p.id,
        text: p.text || "",
        date: p.publicationDate ? p.publicationDate.dateTime : null,
        network: provider.network || "",
        draft: !!p.draft,
        media: media
      };
    });

    return new Response(JSON.stringify({ posts }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=120" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err && err.message ? err.message : err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const config = { path: "/api/scheduled" };
