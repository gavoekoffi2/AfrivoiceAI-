import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formate un montant en FCFA
 */
export function formatFcfa(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fr-TG", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Normalise un numéro de téléphone au format E.164
 * Retourne null si le numéro est invalide
 */
export function normalizePhoneNumber(
  phone: string,
  defaultCountry: string = "TG"
): string | null {
  try {
    if (isValidPhoneNumber(phone, defaultCountry as "TG")) {
      const parsed = parsePhoneNumber(phone, defaultCountry as "TG");
      return parsed.format("E.164");
    }
    // Essayer sans le pays par défaut
    if (isValidPhoneNumber(phone)) {
      const parsed = parsePhoneNumber(phone);
      return parsed.format("E.164");
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Génère un slug URL-friendly depuis un nom
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Formate une durée en secondes en format lisible (mm:ss)
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

/**
 * Tronque un texte à une longueur maximale
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

/**
 * Retourne le label du statut d'un appel
 */
export function getCallStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    queued: "En attente",
    ringing: "Sonnerie",
    "in-progress": "En cours",
    completed: "Terminé",
    failed: "Échoué",
    "no-answer": "Sans réponse",
  };
  return labels[status] ?? status;
}

/**
 * Retourne le label du statut d'une commande
 */
export function getOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "En attente",
    calling: "Appel en cours",
    confirmed: "Confirmée",
    cancelled: "Annulée",
    no_answer: "Sans réponse",
  };
  return labels[status] ?? status;
}
