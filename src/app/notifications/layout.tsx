import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notifications",
  description:
    "Ton activité Solange : offres, ventes, nouveaux abonnés, likes et drops en direct.",
};

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
