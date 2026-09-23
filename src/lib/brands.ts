/* ============================================================
   SOLANGE — base de marques.

   Pourquoi ce fichier. Jusqu'ici la liste des marques était DÉRIVÉE du
   catalogue de démonstration : `[...new Set(catalog.map(it => it.brand))]`.
   Le jour où le catalogue fictif disparaît, la liste disparaît avec lui —
   et le champ « marque » du dépôt d'annonce est un champ libre, donc
   « Nike », « nike » et « NIKE » créent trois marques différentes dans les
   filtres.

   Cette base sert deux choses, et rien d'autre :
   - suggérer une marque au dépôt d'annonce (liste ouverte : on peut
     toujours saisir ce qui n'y est pas, personne ne connaît tout) ;
   - normaliser la casse pour que le filtre du Marché regroupe ce qui doit
     l'être.

   Elle ne crée AUCUN produit. Une marque présente ici sans pièce à vendre
   n'apparaît nulle part côté acheteur.
   ============================================================ */

/** Univers d'une marque — sert à ne proposer que les maisons pertinentes
    quand une catégorie est choisie au dépôt. */
export type Univers = "mode" | "parfum";

export type Marque = { nom: string; univers: Univers };

/* ---------- Mode ---------- */

const LUXE = [
  "Alaïa",
  "Alexander McQueen",
  "Balenciaga",
  "Balmain",
  "Berluti",
  "Bottega Veneta",
  "Brunello Cucinelli",
  "Burberry",
  "Celine",
  "Chanel",
  "Chloé",
  "Christian Louboutin",
  "Courrèges",
  "Dior",
  "Dolce & Gabbana",
  "Dries Van Noten",
  "Fendi",
  "Ferragamo",
  "Giorgio Armani",
  "Givenchy",
  "Gucci",
  "Hermès",
  "Isabel Marant",
  "Jacquemus",
  "Jil Sander",
  "Lanvin",
  "Loewe",
  "Louis Vuitton",
  "Maison Margiela",
  "Marni",
  "Miu Miu",
  "Moncler",
  "Mugler",
  "Off-White",
  "Paco Rabanne",
  "Prada",
  "Saint Laurent",
  "Salvatore Ferragamo",
  "Schiaparelli",
  "Thom Browne",
  "Valentino",
  "Versace",
  "Vetements",
  "Vivienne Westwood",
  "Y/Project",
  "Zegna",
];

const ARCHIVE = [
  "Ann Demeulemeester",
  "Carol Christian Poell",
  "Comme des Garçons",
  "Helmut Lang",
  "Issey Miyake",
  "Junya Watanabe",
  "Kiko Kostadinov",
  "Martine Rose",
  "Raf Simons",
  "Rick Owens",
  "Sacai",
  "Undercover",
  "Walter Van Beirendonck",
  "Yohji Yamamoto",
];

const STREETWEAR = [
  "A Bathing Ape",
  "Aimé Leon Dore",
  "Awake NY",
  "Bode",
  "Carhartt WIP",
  "Corteiz",
  "Daily Paper",
  "Drôle de Monsieur",
  "Fear of God",
  "Kith",
  "Norse Projects",
  "Palace",
  "Patta",
  "Represent",
  "Stone Island",
  "Stüssy",
  "Supreme",
  "Trapstar",
  "Wasted Paris",
  "032c",
  "Ader Error",
  "Alltimers",
  "Anti Social Social Club",
  "Arte Antwerp",
  "Avnier",
  "Billionaire Boys Club",
  "Brain Dead",
  "Butter Goods",
  "Cav Empt",
  "Chrome Hearts",
  "Denim Tears",
  "Dime",
  "Edwin",
  "Gallery Dept",
  "Golf Wang",
  "Human Made",
  "Isabel Marant Étoile",
  "Jaded London",
  "KidSuper",
  "MSCHF",
  "Neighborhood",
  "Noah",
  "Obey",
  "Octobre Éditions",
  "Pleasures",
  "Polar Skate Co",
  "Rhude",
  "Sporty & Rich",
  "Stray Rats",
  "The Hundreds",
  "Thrasher",
  "Unknown London",
  "Vans Vault",
  "Verdy",
  "Yardsale",
];

const SNEAKERS = [
  "Adidas",
  "Asics",
  "Converse",
  "Hoka",
  "Jordan",
  "Mizuno",
  "New Balance",
  "Nike",
  "On Running",
  "Puma",
  "Reebok",
  "Salomon",
  "Saucony",
  "Veja",
  "Vans",
];

const CONTEMPORAIN = [
  "& Other Stories",
  "A.P.C.",
  "Acne Studios",
  "American Vintage",
  "Arket",
  "Ba&sh",
  "Barbour",
  "Cos",
  "Diesel",
  "Ganni",
  "Levi's",
  "Lacoste",
  "Mango",
  "Massimo Dutti",
  "Maje",
  "Nanushka",
  "Polo Ralph Lauren",
  "Ralph Lauren",
  "Sandro",
  "Sézane",
  "The Kooples",
  "Tommy Hilfiger",
  "Uniqlo",
  "Zara",
];

const OUTDOOR = [
  "Arc'teryx",
  "Canada Goose",
  "Columbia",
  "Mammut",
  "Patagonia",
  "Snow Peak",
  "The North Face",
  "Woolrich",
];

const MAROQUINERIE = [
  "Aesther Ekme",
  "Coach",
  "Delvaux",
  "Goyard",
  "Jacquemus Bags",
  "Longchamp",
  "Mansur Gavriel",
  "Polène",
  "Strathberry",
];

/* ---------- Parfum ---------- */

const PARFUM_NICHE = [
  "Amouage",
  "Atelier Cologne",
  "Aesop",
  "BDK Parfums",
  "Byredo",
  "Creed",
  "Diptyque",
  "Escentric Molecules",
  "État Libre d'Orange",
  "Frederic Malle",
  "Histoires de Parfums",
  "Initio",
  "Jo Malone",
  "Juliette Has a Gun",
  "Kilian",
  "L'Artisan Parfumeur",
  "Le Labo",
  "Maison Crivelli",
  "Maison Francis Kurkdjian",
  "Maison Margiela Replica",
  "Memo Paris",
  "Mancera",
  "Montale",
  "Nishane",
  "Parfums de Marly",
  "Penhaligon's",
  "Roja Parfums",
  "Serge Lutens",
  "Stéphane Humbert Lucas",
  "The Different Company",
  "Tom Ford",
  "Xerjoff",
  "Zarkoperfume",
  "Acqua di Sale",
  "Amouroud",
  "Bortnikoff",
  "Carner Barcelona",
  "Clive Christian",
  "Comme des Garçons Parfums",
  "D.S. & Durga",
  "Ex Nihilo",
  "Floraïku",
  "Fueguia 1833",
  "Goldfield & Banks",
  "Hiram Green",
  "Imaginary Authors",
  "Jacques Fath",
  "Jusbox",
  "Kerosene",
  "Laboratorio Olfattivo",
  "Liquides Imaginaires",
  "Lorenzo Pazzaglia",
  "M. Micallef",
  "Maison Alhambra",
  "Mind Games",
  "Naomi Goodsir",
  "Nasomatto",
  "Nobile 1942",
  "Orto Parisi",
  "Ormonde Jayne",
  "Parfum d\u2019Empire",
  "Profumum Roma",
  "Slumberhouse",
  "Tiziana Terenzi",
  "Vilhelm Parfumerie",
  "Zoologist",
];

const PARFUM_DESIGNER = [
  "Acqua di Parma",
  "Armani Beauty",
  "Azzaro",
  "Bvlgari",
  "Burberry Beauty",
  "Calvin Klein",
  "Carolina Herrera",
  "Cartier",
  "Chanel Parfums",
  "Dior Parfums",
  "Dolce & Gabbana Beauty",
  "Giorgio Armani Parfums",
  "Givenchy Parfums",
  "Guerlain",
  "Gucci Beauty",
  "Hermès Parfums",
  "Hugo Boss",
  "Issey Miyake Parfums",
  "Jean Paul Gaultier",
  "Lancôme",
  "Loewe Perfumes",
  "Mugler Parfums",
  "Narciso Rodriguez",
  "Paco Rabanne Parfums",
  "Prada Beauty",
  "Ralph Lauren Fragrances",
  "Thierry Mugler",
  "Valentino Beauty",
  "Versace Profumi",
  "Viktor & Rolf",
  "Yves Saint Laurent Beauté",
];

const PARFUM_ORIENTAL = [
  "Abdul Samad Al Qurashi",
  "Afnan",
  "Ajmal",
  "Al Haramain",
  "Arabian Oud",
  "Armaf",
  "Lattafa",
  "Rasasi",
  "Swiss Arabian",
  "The Spirit of Dubai",
];

/* Compléments — ajoutés après coup, gardés dans leurs propres tableaux
   pour que l'origine de chaque lot reste lisible. */

const ARCHIVE_2 = [
  "Bernhard Willhelm",
  "Boris Bidjan Saberi",
  "Craig Green",
  "Dirk Bikkembergs",
  "Gosha Rubchinskiy",
  "Hussein Chalayan",
  "Julius",
  "Kapital",
  "Lemaire",
  "Number (N)ine",
  "Our Legacy",
  "Post Archive Faction",
  "Toga",
  "Visvim",
];

const SNEAKERS_2 = [
  "Autry",
  "Brooks",
  "Common Projects",
  "Diadora",
  "Dr. Martens",
  "Golden Goose",
  "Karhu",
  "Le Coq Sportif",
  "Maison Mihara Yasuhiro",
  "Merrell",
  "Onitsuka Tiger",
  "Timberland",
  "Umbro",
  "Yeezy",
];

const CONTEMPORAIN_2 = [
  "Agnès b.",
  "American Apparel",
  "Anine Bing",
  "Aritzia",
  "Bershka",
  "Bimba y Lola",
  "Calvin Klein Jeans",
  "Champion",
  "Claudie Pierlot",
  "Ellesse",
  "Filippa K",
  "Gap",
  "Gerard Darel",
  "Guess",
  "H&M",
  "IRO",
  "Jott",
  "Kaporal",
  "Lee",
  "Lululemon",
  "Nudie Jeans",
  "Pull & Bear",
  "Reformation",
  "Rouje",
  "Scotch & Soda",
  "Superdry",
  "Totême",
  "Urban Outfitters",
  "Weekday",
  "Wrangler",
];

const LUXE_2 = [
  "Amiri",
  "Bally",
  "Brioni",
  "Canali",
  "Casablanca",
  "Chopard",
  "Church's",
  "Coperni",
  "Diane von Furstenberg",
  "Emilio Pucci",
  "Etro",
  "Giambattista Valli",
  "Gianvito Rossi",
  "Jimmy Choo",
  "Khaite",
  "La Perla",
  "Loro Piana",
  "Max Mara",
  "Missoni",
  "Nina Ricci",
  "Oscar de la Renta",
  "Patou",
  "Peter Do",
  "Pierre Cardin",
  "Rabanne",
  "Roberto Cavalli",
  "Rochas",
  "Simone Rocha",
  "Stella McCartney",
  "The Attico",
  "The Row",
  "Tod's",
  "Tory Burch",
  "Ulla Johnson",
  "Zimmermann",
];

const OUTDOOR_2 = [
  "66 North",
  "Aigle",
  "And Wander",
  "Berghaus",
  "Fjällräven",
  "Helly Hansen",
  "Klättermusen",
  "Millet",
  "Norrøna",
  "Peak Performance",
  "Rab",
  "Salewa",
  "Ten C",
];

const MAROQUINERIE_2 = [
  "Aspinal of London",
  "Cabaïa",
  "Eastpak",
  "Herschel",
  "Jérôme Dreyfuss",
  "Kate Spade",
  "Lancel",
  "Le Tanneur",
  "Manu Atelier",
  "Michael Kors",
  "Rains",
  "Rimowa",
  "Samsonite",
  "Songmont",
  "Telfar",
  "Vanessa Bruno",
  "Wandler",
];

function marques(noms: string[], univers: Univers): Marque[] {
  return noms.map((nom) => ({ nom, univers }));
}

/** Toutes les marques, dédoublonnées et triées. Une maison peut exister
    des deux côtés (Dior habille et parfume) : elle apparaît alors deux
    fois, sous son libellé propre à chaque univers. */
export const MARQUES: Marque[] = [
  ...marques(
    [
      ...LUXE,
      ...ARCHIVE,
      ...STREETWEAR,
      ...SNEAKERS,
      ...CONTEMPORAIN,
      ...OUTDOOR,
      ...MAROQUINERIE,
    ],
    "mode",
  ),
  ...marques(
    [...PARFUM_NICHE, ...PARFUM_DESIGNER, ...PARFUM_ORIENTAL],
    "parfum",
  ),
]
  .filter((m, i, all) => all.findIndex((x) => x.nom === m.nom) === i)
  .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

/** Noms proposés au dépôt, filtrés par univers si on en connaît un. */
export function suggestions(univers?: Univers): string[] {
  return MARQUES.filter((m) => !univers || m.univers === univers).map(
    (m) => m.nom,
  );
}

/** Ramène une saisie libre sur le libellé canonique quand il existe.
    « nike », « NIKE » et « Nike » désignent la même maison : sans ça, le
    filtre du Marché en affiche trois. La comparaison ignore la casse, les
    accents et la ponctuation — « A.P.C. » et « apc » se rejoignent. */
export function normaliserMarque(saisie: string): string {
  const cle = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();
  const k = cle(saisie);
  if (!k) return "";
  return MARQUES.find((m) => cle(m.nom) === k)?.nom ?? saisie.trim();
}
