import crypto from "node:crypto";

/**
 * Prévient l'équipe (webhook Discord facultatif : NOTIFY_WEBHOOK_URL).
 * Ne bloque jamais la requête : les erreurs sont seulement journalisées.
 */
export async function notifyStaff(text: string) {
  const url = process.env.NOTIFY_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.slice(0, 1900), allowed_mentions: { parse: [] } }),
    });
  } catch (e) {
    console.error("Notification équipe impossible :", e);
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Email au client, envoyé par hytlabs.com (wp_mail → Brevo) : route REST de l'extension
 * hytlabs-studio-sso, signée avec SSO_SECRET. Seuls les comptes ayant accès au studio peuvent la recevoir.
 */
export async function notifyClient(to: string, subject: string, lines: string[], cta?: { label: string; url: string }) {
  const secret = process.env.SSO_SECRET;
  const base = process.env.WP_NOTIFY_URL ?? "https://hytlabs.com/wp-json/hytlabs-studio/v1/notify";
  if (!secret || !to) return false;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#14141f">
<h2 style="margin:0 0 16px">${esc(subject)}</h2>
${lines.map((l) => `<p style="line-height:1.5;margin:0 0 12px">${esc(l)}</p>`).join("\n")}
${cta ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#1769E8;color:#fff;text-decoration:none;font-weight:bold">${esc(cta.label)}</a></p>` : ""}
<p style="color:#888;font-size:12px;margin-top:28px">Studio vidéo HytLabs · video.hytlabs.com</p></div>`;
  const body = JSON.stringify({ to, subject, html, ts: Math.floor(Date.now() / 1000) });
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  try {
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Studio-Signature": sig, "User-Agent": "HytLabs-Studio" },
      body,
    });
    if (!res.ok) console.error("Email client refusé :", res.status, (await res.text()).slice(0, 200));
    return res.ok;
  } catch (e) {
    console.error("Email client impossible :", e);
    return false;
  }
}
