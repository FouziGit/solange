import { announce } from "./announce";

/**
 * Partager une publication : la feuille de partage du téléphone (Messages,
 * WhatsApp, Instagram…) quand elle existe, sinon le lien est copié.
 * Renvoie "copied" quand le lien a été copié, pour un retour à l'écran.
 */
export async function sharePost(opts: {
  title: string;
  text: string;
  path: string;
}): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  const url = new URL(opts.path, location.origin).toString();
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: opts.title, text: opts.text, url });
      return "shared";
    } catch (e) {
      // la personne a fermé la feuille : rien à dire
      if (e instanceof DOMException && e.name === "AbortError")
        return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    announce("Lien copié.");
    return "copied";
  } catch {
    announce("Le lien n'a pas pu être copié.", "assertive");
    return "failed";
  }
}
