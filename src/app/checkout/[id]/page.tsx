import { notFound } from "next/navigation";
import { catalog, catalogItem } from "@/lib/mock";
import { CheckoutView } from "./CheckoutView";

/** Pre-render a checkout page for every catalog tile. */
export function generateStaticParams() {
  return catalog.map((it) => ({ id: it.id }));
}

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
