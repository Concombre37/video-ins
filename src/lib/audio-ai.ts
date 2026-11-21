import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./space-data";
import { VOICES, type VoiceId } from "./voices";

/**
 * Sons générés pour les retouches audio :
 *  - voix off ElevenLabs (ELEVENLABS_API_KEY), mises en cache par texte + voix + vitesse
 *    (l'écoute dans le formulaire et la retouche réutilisent le même fichier, payé une seule fois) ;
 *  - musiques Google Lyria via OpenRouter (OPENROUTER_API_KEY).
 */
const CACHE = path.join(DATA_DIR, "tts-cache");
/** prix ElevenLabs au caractère (paiement à l'usage), en dollars pour 1000 caractères */
const TTS_USD_PER_1K = () => Number(process.env.ELEVENLABS_USD_PER_1K) || 0.3;

export function ttsKey(voiceId: string, text: string, speed: number) {
  return crypto.createHash("sha256").update(`${voiceId}|${speed.toFixed(2)}|${text}`).digest("hex").slice(0, 32);
}

/** Voix off en MP3. `cost` (USD) vaut 0 si la phrase était déjà en cache. */
export async function tts(voiceId: VoiceId, text: string, speed = 1) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("synthèse vocale non configurée");
  const file = path.join(CACHE, `${ttsKey(voiceId, text, speed)}.mp3`);
  try {
    await fs.access(file);
    return { file, cost: 0 };
  } catch {
    /* pas encore générée */
  }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", "User-Agent": "HytLabs-Studio" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true, speed: Math.min(1.2, Math.max(0.7, speed)) },
    }),
  });
  if (!res.ok) throw new Error(`synthèse vocale refusée (${res.status}) ${(await res.text()).slice(0, 200)}`);
  const data = new Uint8Array(await res.arrayBuffer());
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(`${file}.tmp`, data);
  await fs.rename(`${file}.tmp`, file);
  return { file, cost: (text.length / 1000) * TTS_USD_PER_1K() };
}

/** Extraits d'écoute gratuits fournis par ElevenLabs pour chaque voix (cache 6 h). */
const g = globalThis as unknown as { __voicePreviews?: { at: number; urls: Record<string, string> } };
export async function voicePreviews(): Promise<Record<string, string>> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return {};
  if (g.__voicePreviews && Date.now() - g.__voicePreviews.at < 6 * 3600_000) return g.__voicePreviews.urls;
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key, "User-Agent": "HytLabs-Studio" } });
    if (!res.ok) return {};
    const body = (await res.json()) as { voices?: { voice_id: string; preview_url?: string }[] };
    const urls: Record<string, string> = {};
    for (const v of body.voices ?? []) {
      if (v.preview_url && VOICES.some((x) => x.id === v.voice_id)) urls[v.voice_id] = v.preview_url;
    }
    g.__voicePreviews = { at: Date.now(), urls };
    return urls;
  } catch {
    return {};
  }
}

/** Morceau instrumental généré par Lyria (30 s : modèle clip, plus long : modèle pro). */
export async function generateMusic(prompt: string, seconds: number) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("génération de musique non configurée");
  const long = seconds > 30;
  const model = long ? "google/lyria-3-pro-preview" : "google/lyria-3-clip-preview";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "HytLabs Studio" },
    body: JSON.stringify({
      model,
      stream: true,
      modalities: ["audio"],
      messages: [
        {
          role: "user",
          content: `Instrumental music for an advertising video, no vocals, about ${Math.ceil(seconds)} seconds, clean ending. ${prompt}`,
        },
      ],
    }),
  });
  if (!res.ok || !res.body) throw new Error(`génération de musique refusée (${res.status})`);
  const chunks: Uint8Array[] = [];
  const decoder = new TextDecoder();
  let buf = "";
  for await (const part of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += decoder.decode(part, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      const d = JSON.parse(line.slice(6));
      if (d.error) throw new Error(`génération de musique : ${d.error.message ?? "erreur"}`);
      for (const c of d.choices ?? []) {
        const a = c.delta?.audio?.data;
        if (a) chunks.push(new Uint8Array(Buffer.from(a, "base64")));
      }
    }
  }
  if (!chunks.length) throw new Error("la génération de musique n'a rien renvoyé");
  const data = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    data.set(c, o);
    o += c.length;
  }
  return { data, cost: long ? 0.08 : 0.04 };
}
