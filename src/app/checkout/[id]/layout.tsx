import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paiement",
  description: "Paiement sécurisé par carte, via Stripe.",
  robots: { index: false },
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
