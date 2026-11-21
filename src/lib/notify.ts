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
    console.error("Notification impossible :", e);
  }
}
