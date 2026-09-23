/* ============================================================
   SOLANGE — Journal.

   Vrais articles, écrits pour la V1. Ils ne vivent PAS dans mock.ts :
   ce n'est pas du contenu de démonstration, c'est la parole de la
   maison. Le jour où le Journal se remplit depuis un back-office, ce
   fichier disparaît — pas avant.

   Règle éditoriale : on n'invente ici aucun chiffre, aucune citation,
   aucun partenariat. Ces deux textes ne parlent que de ce que SOLANGE
   fait réellement aujourd'hui.
   ============================================================ */

import type { Article } from "./mock";

export const articles: Article[] = [
  {
    id: "a-pourquoi-solange",
    kind: "entretien",
    title: "Pourquoi on a fait SOLANGE",
    standfirst:
      "Deux personnes, un constat simple : revendre une pièce qu'on aime est devenu pénible, et acheter d'occasion ressemble de moins en moins à de la chine.",
    creatorHandle: "nouh",
    seed: "solange-journal-01",
    productIds: [],
    readingMin: 4,
    date: "2026-09-23", // ISO : la page de détail la formate elle-même
    paragraphs: [
      "On a commencé par une frustration d'usage, pas par une idée de marché. Revendre une veste qu'on a portée trois ans, c'est aujourd'hui remplir un formulaire, choisir une taille dans une liste qui ne correspond pas, poser une photo sur un parquet, et attendre. L'objet mérite mieux que ça.",
      "SOLANGE part de l'inverse. La pièce d'abord : une image en plein écran, la maison, la matière, l'état dit franchement. Le reste vient après. On a construit le fil comme on regarde une vitrine, pas comme on parcourt un tableur.",
      "Il y a une chose qu'on a décidé tôt et qu'on tient : ne rien afficher qui ne soit pas vrai. Pas de compteur de vues gonflé, pas de « 12 personnes regardent cette pièce », pas de fausse rareté. Si trois personnes utilisent l'app un mardi soir, l'app montre trois personnes. C'est moins flatteur et ça se remarque, mais c'est la seule base sur laquelle une confiance tient.",
      "Ça a des conséquences visibles. Au lancement, le Marché est presque vide. Les Cercles n'ont pas encore de conversation. Le Journal a deux articles, celui-ci et un autre. On aurait pu remplir tout ça de contenu fabriqué — beaucoup le font, et personne ne le reproche. On a préféré une app honnêtement petite à une app faussement grande.",
      "L'autre décision, c'est la commission. Elle est dégressive : 4 % sous 200 €, puis 3,5 %, 2,5 %, et 2 % au-delà de 1 000 €. Plus la pièce est chère, moins on prend en proportion, parce qu'une pièce chère ne nous coûte pas plus à héberger qu'une autre. Elle est affichée avant la mise en ligne, jamais découverte après.",
      "Enfin, il faut le dire clairement : à ce stade, les paiements sont simulés. Aucune somme n'est débitée, aucune donnée bancaire n'est collectée. Le paiement réel demande une société immatriculée et un prestataire agréé — c'est en cours, et ce sera annoncé le jour où ce sera vrai, pas avant.",
      "Si vous êtes là maintenant, vous arrivez avant tout le monde, sur quelque chose d'inachevé. C'est exactement le moment où votre avis compte le plus. Écrivez-nous : on lit tout.",
    ],
  },
  {
    id: "a-vendre-une-piece",
    kind: "focus",
    title: "Bien vendre une pièce : ce qui change tout",
    standfirst:
      "La photo, la description, le prix. Trois choses, et la troisième est celle qu'on rate le plus souvent.",
    creatorHandle: "youssef",
    seed: "solange-journal-02",
    productIds: [],
    readingMin: 5,
    date: "2026-09-23", // ISO : la page de détail la formate elle-même
    paragraphs: [
      "Une annonce qui ne part pas, ce n'est presque jamais la pièce. C'est la manière de la montrer. Voilà ce qu'on a observé, et ce qu'on ferait à votre place.",
      "La lumière du jour, près d'une fenêtre, sans flash. Le flash écrase la matière : un cachemire et un acrylique s'y ressemblent, et c'est précisément ce que l'acheteur cherche à distinguer. Photographiez le matin ou en fin d'après-midi, jamais en plein soleil direct.",
      "Un fond uni. Un mur blanc, un drap tendu, une porte. Ce qui traîne derrière vous raconte quelque chose de la pièce, et rarement à son avantage. C'est le geste le plus simple et celui qui change le plus la perception.",
      "Montrez le défaut. Une bouloche, un ourlet repris, une semelle marquée : photographiez-les, en gros plan, et dites-les dans la description. On croit perdre une vente, on en gagne la confiance — et surtout on évite le litige, qui coûte bien plus cher qu'une remise de dix euros.",
      "Sur la description, soyez concret. « Taille M mais taille petit, je fais habituellement du L » vaut mille fois mieux que « très bon état, peu porté ». Donnez vos mensurations si la coupe est particulière, mesurez l'épaule à plat, dites combien de fois la pièce a été portée. Ce sont les questions qu'on vous posera de toute façon en message.",
      "Le prix, maintenant. C'est là que la plupart se trompent, dans les deux sens. Trop haut, la pièce ne bouge pas et vieillit dans le Marché ; trop bas, elle part en deux heures et vous le regrettez. Regardez ce que la même pièce s'échange ailleurs, retirez l'émotion, et souvenez-vous que le prix d'achat n'a aucune importance pour celui qui l'achète aujourd'hui.",
      "Une règle simple : si votre pièce n'a reçu aucun message en deux semaines, ce n'est pas le marché, c'est le prix. Baissez de 15 %, pas de 5 % — une baisse invisible ne déclenche rien.",
      "Dernier point, et c'est celui qui fait revenir les acheteurs : expédiez vite. Trois jours, pas sept. Une pièce reçue plus tôt que prévu, bien emballée, avec un mot, c'est ce qui transforme un acheteur en habitué.",
    ],
  },
];
