import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { legalDoc } from "@/lib/legal";

/* Le texte vit dans legal/confidentialite.md — source unique (D-035). */
const doc = legalDoc("confidentialite");

export const metadata: Metadata = {
  title: doc?.title,
  description: doc?.summary,
};

export default function Page() {
  return <LegalDocument slug="confidentialite" />;
}
