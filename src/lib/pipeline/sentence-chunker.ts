/**
 * Découpe un flux de deltas LLM en phrases pour le TTS streaming.
 * L'audio de la première phrase peut ainsi partir pendant que la suite du
 * texte est encore en génération — clé de la latence < 1,5 s.
 */
export class SentenceChunker {
  private buffer = "";

  constructor(private readonly maxChars = 160) {}

  /** Ajoute un delta et retourne les phrases complètes disponibles. */
  push(delta: string): string[] {
    this.buffer += delta;
    const out: string[] = [];

    for (;;) {
      const match = this.buffer.match(/[.!?…:;]["»')\]]?(\s|$)/);
      if (match && match.index !== undefined) {
        const end = match.index + match[0].length;
        const sentence = this.buffer.slice(0, end).trim();
        this.buffer = this.buffer.slice(end);
        if (sentence) out.push(sentence);
        continue;
      }
      // Pas de ponctuation mais buffer trop long : coupe au dernier espace.
      if (this.buffer.length > this.maxChars) {
        const cut = this.buffer.lastIndexOf(" ", this.maxChars);
        if (cut > 0) {
          const fragment = this.buffer.slice(0, cut).trim();
          this.buffer = this.buffer.slice(cut + 1);
          if (fragment) out.push(fragment);
          continue;
        }
      }
      break;
    }
    return out;
  }

  /** Vide ce qui reste (fin de génération). */
  flush(): string | null {
    const rest = this.buffer.trim();
    this.buffer = "";
    return rest || null;
  }
}
