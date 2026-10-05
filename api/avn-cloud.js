// AVN Cloud Server Bridge — Vercel Serverless Function
export default async function handler(req, res) {
  const allowedOrigin = req.headers.origin || "";
  const siteOrigin = process.env.AVN_SITE_ORIGIN || "";
  if (siteOrigin && allowedOrigin && allowedOrigin !== siteOrigin) {
    return res.status(403).json({ error: "Origin non autorisée." });
  }

  const suppliedPassword = String(req.headers["x-avn-admin-password"] || "");
  const expectedPassword = String(process.env.AVN_LOCAL_ADMIN_PASSWORD || "");
  if (!expectedPassword || suppliedPassword !== expectedPassword) {
    return res.status(401).json({ error: "Accès Cloud AVN non autorisé." });
  }

  const table = String(req.query?.table || "");
  const allowedTables = new Set(["avn_app_state", "students", "school_members"]);
  if (!allowedTables.has(table)) {
    return res.status(400).json({ error: "Table AVN non autorisée." });
  }

  const base = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!base || !serviceKey) {
    return res.status(500).json({ error: "Configuration Supabase serveur manquante." });
  }

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key !== "table") {
      if (Array.isArray(value)) value.forEach(v => qs.append(key, String(v)));
      else qs.set(key, String(value));
    }
  }

  const url = `${base}/rest/v1/${encodeURIComponent(table)}${qs.toString() ? "?" + qs.toString() : ""}`;

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(req.headers.prefer ? { "Prefer": req.headers.prefer } : {})
      },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body ?? {})
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (err) {
    return res.status(502).json({ error: String(err?.message || err) });
  }
}
