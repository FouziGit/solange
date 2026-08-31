import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { legalDoc } from "@/lib/legal";

/* Le texte vit dans legal/cgv.md — source unique (D-033). */
const doc = legalDoc("cgv");

export const metadata: Metadata = {
  title: doc?.title,
  description: doc?.summary,
};

export default function Page() {
  return <LegalDocument slug="cgv" />;
}
