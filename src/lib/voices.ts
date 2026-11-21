/**
 * Voix off proposées aux clients (ElevenLabs, modèle multilingue, toutes à l'aise en français).
 * Partagé entre l'interface (choix de la voix) et le serveur (synthèse).
 */
export const VOICES = [
  { id: "cuo3D4C6LVenyV7b2Kpd", name: "Anna", gender: "f", hint: "posée, style annonce / F1" },
  { id: "MmafIMKg28Wr0yMh8CEB", name: "Laura", gender: "f", hint: "grave et dynamique, réseaux sociaux" },
  { id: "r77acJhQ7tAysM3mQTBA", name: "Paula", gender: "f", hint: "chaleureuse, conversation" },
  { id: "NEjemlRxgWmL5ZGJetsB", name: "Claire", gender: "f", hint: "naturelle, conversation" },
  { id: "KSyQzmsYhFbuOhqj1Xxv", name: "Léa", gender: "f", hint: "créatrice de contenu, spontanée" },
  { id: "ZYOBieLaunTiQrTrvNQq", name: "Morgane", gender: "f", hint: "très expressive" },
  { id: "odOFTFZU3DvAZ3EV3KHi", name: "Lucas", gender: "m", hint: "narrateur pro, corporate" },
  { id: "OPCL81coXM3AEo8gUxHM", name: "Maxime", gender: "m", hint: "dynamique et joyeux" },
  { id: "jsScnYkNNda9Q1NES5nn", name: "Léo", gender: "m", hint: "énergique, pub" },
] as const;

export type VoiceId = (typeof VOICES)[number]["id"];
export const DEFAULT_VOICE: VoiceId = "cuo3D4C6LVenyV7b2Kpd";
export const isVoiceId = (v: unknown): v is VoiceId => VOICES.some((x) => x.id === v);
export const voiceName = (id: string) => VOICES.find((v) => v.id === id)?.name ?? "Voix";
export const MAX_TTS_CHARS = 600;
