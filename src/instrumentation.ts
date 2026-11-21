/** Au démarrage du serveur : relance les retouches automatiques interrompues. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  setTimeout(async () => {
    try {
      const { resumePending } = await import("./lib/auto-retouch");
      await resumePending();
    } catch (e) {
      console.error("Reprise des retouches impossible :", e);
    }
  }, 5_000);
}
