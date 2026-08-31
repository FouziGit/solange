import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { legalDoc } from "@/lib/legal";

/* Le texte vit dans legal/cgu.md — source unique (D-033). */
const doc = legalDoc("cgu");

export const metadata: Metadata = {
  title: doc?.title,
  description: doc?.summary,
};

export default function Page() {
  return <LegalDocument slug="cgu" />;
}
