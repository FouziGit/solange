/* ============================================================
   SOLANGE — photo de profil. Fonctions PURES, partagées client
   (recadrage avant envoi) / serveur (contrôle et nettoyage du JPEG,
   importé avec l'extension .ts). Testées dans
   src/lib/__tests__/avatar.test.ts.

   Le serveur ne décode pas l'image : il relit la structure du JPEG et
   n'en recopie que ce qui sert à l'afficher. EXIF (dont la position GPS),
   XMP, commentaires, vignettes et images accolées après la fin
   disparaissent, quel que soit l'appareil d'origine.
   ============================================================ */

export const AVATAR_PX = 512;
export const AVATAR_QUALITY = 0.85;
export const AVATAR_MAX_BYTES = 400_000;
export const AVATAR_MAX_SIDE = 2048;

/** Carré centré dans une image w × h, réduit à `max` au plus, jamais
    agrandi. */
export function squareCropRect(
  w: number,
  h: number,
  max = AVATAR_PX,
): { sx: number; sy: number; side: number; out: number } {
  const side = Math.min(w, h);
  return {
    sx: Math.floor((w - side) / 2),
    sy: Math.floor((h - side) / 2),
    side,
    out: Math.floor(Math.min(side, max)),
  };
}

const AVATAR_PATH = /^\/api\/img\/(i_[a-f0-9]{12})$/;

export function isAvatarPath(v: unknown): v is string {
  return typeof v === "string" && AVATAR_PATH.test(v);
}

export function imgIdFromPath(p: unknown): string | null {
  if (typeof p !== "string") return null;
  return AVATAR_PATH.exec(p)?.[1] ?? null;
}

export function isJpeg(b: Uint8Array): boolean {
  return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}

/* ---------- nettoyage par liste blanche ---------- */

const SOF = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
  0xcf,
]);
const TABLES = new Set([0xdb, 0xc4, 0xdd]); // DQT, DHT, DRI
const APP0 = 0xe0;
const APP2 = 0xe2;
const APP14 = 0xee;
const SOS = 0xda;
const EOI = 0xd9;
/** Retirés sans condition : APP1 (EXIF, XMP), APP3-APP13, APP15, COM. */
const DROPPED = new Set([
  0xe1, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, 0xec, 0xed,
  0xef, 0xfe,
]);
/** Un JPEG progressif compte une dizaine de passes. Des milliers de
    passes minuscules ne servent qu'à ralentir le navigateur qui décode. */
const MAX_SCANS = 64;

const JFIF = [0x4a, 0x46, 0x49, 0x46, 0x00]; // "JFIF\0"
const ICC = [...Array.from("ICC_PROFILE", (c) => c.charCodeAt(0)), 0x00];
const ADOBE = Array.from("Adobe", (c) => c.charCodeAt(0));

/** Le segment [at, end) commence-t-il par cette signature ? */
function hasSig(b: Uint8Array, at: number, end: number, sig: number[]) {
  return at + sig.length <= end && sig.every((x, k) => b[at + k] === x);
}

/** APP0, APP2, APP14 : gardés seulement sous une forme connue. APP0 l'est
    sous sa forme JFIF nue (14 octets utiles, vignette 0 × 0) : une
    vignette JFIF est une copie de l'image, pas une donnée d'affichage.
    Les autres (JFXX, MPF, FlashPix…) sont retirés. */
function keptApp(b: Uint8Array, m: number, payload: number, end: number) {
  if (m === APP0)
    return (
      end - payload === 14 &&
      hasSig(b, payload, end, JFIF) &&
      b[payload + 12] === 0 &&
      b[payload + 13] === 0
    );
  if (m === APP2) return hasSig(b, payload, end, ICC);
  return hasSig(b, payload, end, ADOBE);
}

/** Fin des données d'une passe (SOS) : le premier marqueur qui n'est ni
    un octet échappé (FF00) ni un redémarrage (RST0-RST7). -1 si le
    fichier s'arrête avant. */
function scanEnd(b: Uint8Array, from: number): number {
  let p = from;
  while (p + 1 < b.length) {
    if (b[p] === 0xff) {
      const n = b[p + 1];
      if (n !== 0x00 && (n < 0xd0 || n > 0xd7)) return p;
      p += 2;
    } else p++;
  }
  return -1;
}

/** Recopie du JPEG limitée à ce qui sert à l'afficher. `null` si le
    fichier est tronqué, sans fin (EOI), sans en-tête d'image (SOF), porte
    un marqueur inconnu, ou annonce une taille nulle ou supérieure à
    AVATAR_MAX_SIDE. Tout octet après EOI est jeté. */
export function sanitizeJpeg(
  b: Uint8Array,
): { bytes: Uint8Array; width: number; height: number } | null {
  if (!isJpeg(b)) return null;
  const keep: [number, number][] = [[0, 2]]; // SOI
  let i = 2;
  let width = 0;
  let height = 0;
  let scans = 0;

  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    while (i < b.length && b[i] === 0xff) i++; // octets de remplissage
    if (i >= b.length) return null;
    const start = i - 1;
    const m = b[i++];

    if (m === EOI) {
      if (!width || !scans) return null;
      keep.push([start, i]);
      return { bytes: join(b, keep), width, height };
    }

    if (i + 2 > b.length) return null;
    const len = (b[i] << 8) | b[i + 1];
    const end = i + len;
    if (len < 2 || end > b.length) return null;
    const payload = i + 2;

    if (m === SOS) {
      if (!width || ++scans > MAX_SCANS) return null;
      const stop = scanEnd(b, end);
      if (stop < 0) return null;
      keep.push([start, stop]);
      i = stop;
      continue;
    }

    if (SOF.has(m)) {
      if (width || len < 8) return null; // une seule image par fichier
      height = (b[payload + 1] << 8) | b[payload + 2];
      width = (b[payload + 3] << 8) | b[payload + 4];
      if (
        !width ||
        !height ||
        width > AVATAR_MAX_SIDE ||
        height > AVATAR_MAX_SIDE
      )
        return null;
      keep.push([start, end]);
    } else if (m === APP0 || m === APP2 || m === APP14) {
      if (keptApp(b, m, payload, end)) keep.push([start, end]);
    } else if (TABLES.has(m)) {
      keep.push([start, end]);
    } else if (!DROPPED.has(m)) {
      return null; // marqueur inconnu
    }
    i = end;
  }
  return null;
}

function join(b: Uint8Array, ranges: [number, number][]): Uint8Array {
  const out = new Uint8Array(ranges.reduce((n, [s, e]) => n + e - s, 0));
  let o = 0;
  for (const [s, e] of ranges) {
    out.set(b.subarray(s, e), o);
    o += e - s;
  }
  return out;
}
