import { notFound } from "next/navigation";
import { catalog, catalogItem } from "@/lib/mock";
import { CheckoutView } from "./CheckoutView";

/** Pre-render a checkout page for every catalog tile. */
export function generateStaticParams() {
  return catalog.map((it) => ({ id: it.id }));
}

/* Beta : seules les pièces du catalogue (k*) ont une page checkout.
   Les annonces membres ne passent pas par ici — tout autre id => 404. */
export const dynamicParams = false;

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = catalogItem(id);
  if (!item) notFound();

  return <CheckoutView item={item} />;
}
