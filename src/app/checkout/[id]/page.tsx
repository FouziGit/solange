import { MemberCheckout } from "./MemberCheckout";

/* La page de paiement ne connaissait que le catalogue de démonstration
   (pages générées à la construction, tout autre identifiant en 404). Le
   catalogue étant vidé, AUCUNE pièce n'était plus achetable. Elle charge
   désormais l'annonce membre à la demande. */
export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MemberCheckout id={id} />;
}
