import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paiement",
  description: "Paiement sécurisé SOLANGE — simulation Stripe Connect (mode test).",
  robots: { index: false },
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
