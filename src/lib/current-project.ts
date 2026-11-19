"use client";

/** Identifiant du projet ouvert dans l'éditeur, pour rattacher les rendus MP4 à l'historique. */
let currentProjectId: string | null = null;
let hasBeenSaved = false;

export function newProjectId() {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return rand.toLowerCase();
}

export function setCurrentProject(id: string, saved: boolean) {
  currentProjectId = id;
  hasBeenSaved = saved;
}

export function markProjectSaved() {
  hasBeenSaved = true;
}

/** Renvoie l'id seulement si le projet existe déjà côté serveur. */
export function getSavedProjectId() {
  return hasBeenSaved ? currentProjectId : null;
}

/** Signale au bandeau du bas qu'il doit recharger le solde. */
export function notifyBalanceChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("bf-balance-refresh"));
}

let saver: (() => Promise<void>) | null = null;

/** L'éditeur enregistre ici sa fonction de sauvegarde (appelée avant d'archiver un rendu). */
export function registerProjectSaver(fn: (() => Promise<void>) | null) {
  saver = fn;
}

export async function saveCurrentProject() {
  if (saver) await saver();
}
