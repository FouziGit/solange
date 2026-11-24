import { describe, expect, it } from "vitest";
import { ANNONCES_DEMO } from "../annonces-demo";
import { POSTS_DEMO } from "../posts-demo";

/* Le pont look → pièce de la démo : un identifiant qui ne mène à aucune
   pièce fait disparaître le cintre et le « N pièces » de l'étiquette, sans
   un bruit. */
describe("POSTS_DEMO — pièces liées", () => {
  const lies = POSTS_DEMO.filter((p) => p.linkedProductIds?.length);

  it("relie au moins deux looks à des pièces", () => {
    expect(lies.length).toBeGreaterThanOrEqual(2);
  });

  it("ne cite que des pièces de ANNONCES_DEMO", () => {
    const ids = lies.flatMap((p) => p.linkedProductIds ?? []);
    expect(ANNONCES_DEMO.map((a) => a.id)).toEqual(
      expect.arrayContaining(ids),
    );
  });
});
