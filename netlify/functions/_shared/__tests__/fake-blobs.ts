/* Faux store Netlify Blobs, en mémoire, pour les tests des fonctions :
   etags, écritures conditionnelles (onlyIfMatch, onlyIfNew), métadonnées
   et liste par préfixe. `beforeWrite` simule un écrivain concurrent qui
   passe juste avant une écriture. */

type Body = string | ArrayBuffer;
type Entry = { body: Body; etag: string; metadata: Record<string, unknown> };
type WriteOptions = {
  metadata?: Record<string, unknown>;
  onlyIfMatch?: string;
  onlyIfNew?: boolean;
};

let serial = 0;

export class FakeStore {
  entries = new Map<string, Entry>();
  /** Clés réellement écrites, dans l'ordre. */
  writes: string[] = [];
  deletes: string[] = [];
  /** Lectures rendues sans etag (le cas « on n'écrit pas à l'aveugle »). */
  withoutEtag = false;
  beforeWrite?: (key: string, body: Body) => void;

  put(key: string, body: Body, metadata: Record<string, unknown> = {}) {
    this.entries.set(key, { body, etag: `"e${++serial}"`, metadata });
  }
  putJSON(key: string, v: unknown) {
    this.put(key, JSON.stringify(v));
  }
  /** Lecture directe, hors du code testé. */
  peek(key: string): unknown {
    const e = this.entries.get(key);
    if (!e) return null;
    return typeof e.body === "string" ? JSON.parse(e.body) : e.body;
  }
  text(key: string): string | null {
    const e = this.entries.get(key);
    return e && typeof e.body === "string" ? e.body : null;
  }

  private decode(e: Entry, type?: string): unknown {
    if (type === "json") return JSON.parse(String(e.body));
    return e.body;
  }

  async get(key: string, o: { type: "text" }): Promise<string | null>;
  async get(key: string, o?: { type?: string }): Promise<unknown>;
  async get(key: string, o?: { type?: string }): Promise<unknown> {
    const e = this.entries.get(key);
    return e ? this.decode(e, o?.type) : null;
  }

  async getWithMetadata(key: string, o?: { type?: string }) {
    const e = this.entries.get(key);
    if (!e) return null;
    return {
      data: this.decode(e, o?.type),
      etag: this.withoutEtag ? undefined : e.etag,
      metadata: e.metadata,
    };
  }

  async getMetadata(key: string) {
    const e = this.entries.get(key);
    return e ? { etag: e.etag, metadata: e.metadata } : null;
  }

  async set(key: string, body: Body, o?: WriteOptions) {
    return this.write(key, body, o);
  }

  async setJSON(key: string, v: unknown, o?: WriteOptions) {
    return this.write(key, JSON.stringify(v), o);
  }

  private write(key: string, body: Body, o?: WriteOptions) {
    this.beforeWrite?.(key, body);
    const cur = this.entries.get(key);
    if (o?.onlyIfNew && cur) return { modified: false };
    if (o?.onlyIfMatch !== undefined && cur?.etag !== o.onlyIfMatch)
      return { modified: false };
    this.put(key, body, o?.metadata ?? {});
    this.writes.push(key);
    return { modified: true };
  }

  async delete(key: string) {
    this.entries.delete(key);
    this.deletes.push(key);
  }

  async list(o?: { prefix?: string }) {
    const blobs = [...this.entries]
      .filter(([k]) => !o?.prefix || k.startsWith(o.prefix))
      .map(([key, e]) => ({ key, etag: e.etag }));
    return { blobs, directories: [] as string[] };
  }
}

/** Un jeu de stores nommés, créés à la demande (remplace `store()`). */
export function fakeStores() {
  const all = new Map<string, FakeStore>();
  return (name: string): FakeStore => {
    let s = all.get(name);
    if (!s) {
      s = new FakeStore();
      all.set(name, s);
    }
    return s;
  };
}
