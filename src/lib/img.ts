/** Local image paths (downloaded into /public/img, B&W-treated at render). */
export const imgLook = (id: string) => `/img/looks/${id}.jpg`;
export const imgItem = (id: string) => `/img/catalog/${id}.jpg`;
export const imgPerson = (seed: string) => `/img/people/${seed}.jpg`;

/** Les seules graines qui ont un portrait dans /public/img/people. Hors
    de cette liste, pas de portrait de démo : un membre réel ne peut ni
    provoquer un 404 par rendu, ni s'approprier le visage d'un créateur
    de démonstration. */
export const PORTRAIT_SEEDS: ReadonlySet<string> = new Set([
  "lou-mercier-21",
  "maya-d-55",
  "neige-77",
  "samir-b-09",
  "solange-me-01",
  "theo-grail-3",
  "yuki-p-12",
]);

/** Local video clips (cut from runway footage) + their poster frames. */
export const videoLook = (id: string) => `/video/${id}.mp4`;
export const videoPoster = (id: string) => `/video/${id}.jpg`;
