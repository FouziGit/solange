/* ============================================================
   SOLANGE — registre des documents légaux (D-033).
   Le TEXTE vit dans legal/*.md, jamais dans un composant : c'est ce
   qui a produit la politique de confidentialité aujourd'hui fausse,
   personne ne relisant du JSX. Ici on ne tient que la carte : quel
   document, à quelle adresse, dans quelle version.

   LEGAL_VERSION est la version du socle contractuel (CGU +
   confidentialité). Elle est stockée avec l'acceptation de chaque
   membre : c'est ce qui rend l'acceptation prouvable et ce qui
   déclenche la réacceptation quand elle change.
   ============================================================ */

/** Version du socle. À incrémenter à CHAQUE modification substantielle
    des CGU ou de la politique de confidentialité — la réacceptation se
    déclenche seule (voir src/lib/legal-consent.ts). */
export const LEGAL_VERSION = 1;

/** Âge minimum déclaré à l'inscription.
    ⚠️ VALEUR PAR DÉFAUT PRUDENTE, À CONFIRMER PAR L'EXPLOITANT.
    18 ans écarte la question du consentement parental (art. 45 LIL) et
    celle de la capacité à contracter (art. 1148 C. civ.). Descendre à 15
    ans est possible mais suppose un dispositif de recueil du consentement
    parental qui n'existe pas. Un seul endroit à changer : ici et
    legal/mineurs.md. Voir audit/legal/99-a-completer.md. */
export const MIN_AGE = 18;

export type LegalDoc = {
  /** nom du fichier dans legal/, sans extension */
  slug: string;
  /** route publique */
  href: string;
  title: string;
  /** une ligne, affichée sur la page d'index */
  summary: string;
};

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "mentions-legales",
    href: "/mentions-legales",
    title: "Mentions légales",
    summary: "Qui édite le service, qui l'héberge, comment nous joindre.",
  },
  {
    slug: "cgu",
    href: "/cgu",
    title: "Conditions générales d'utilisation",
    summary: "Ce qui vous lie à SOLANGE : compte, contenus, règles, recours.",
  },
  {
    slug: "cgv",
    href: "/cgv",
    title: "Conditions générales de vente",
    summary:
      "Les ventes entre membres. Les paiements sont simulés aujourd'hui.",
  },
  {
    slug: "confidentialite",
    href: "/confidentialite",
    title: "Politique de confidentialité",
    summary:
      "Ce que nous faisons de vos données, et ce que nous ne faisons pas.",
  },
  {
    slug: "cookies",
    href: "/cookies",
    title: "Cookies et stockage local",
    summary:
      "Un seul cookie, aucun traceur, et pourquoi il n'y a pas de bandeau.",
  },
  {
    slug: "charte-moderation",
    href: "/charte-moderation",
    title: "Charte de modération",
    summary:
      "Ce qui est interdit, comment le signaler, comment contester une décision.",
  },
  {
    slug: "mineurs",
    href: "/mineurs",
    title: "Accès des mineurs",
    summary: "Âge requis et ce que le service vérifie réellement.",
  },
];

export function legalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
