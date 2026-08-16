import type { Metadata, Viewport } from "next";
import { Montserrat, Bodoni_Moda, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { CustomCursor } from "@/components/chrome/CustomCursor";
import { GrainOverlay } from "@/components/chrome/GrainOverlay";
import { SideNav } from "@/components/chrome/SideNav";
import { MobileTabBar } from "@/components/chrome/MobileTabBar";
import { FeedThemeLock } from "@/components/chrome/FeedThemeLock";
import { AuthGate } from "@/components/chrome/AuthGate";
import { SolangeProvider } from "@/lib/store";

// Display / titles — Montserrat: geometric, minimalist-luxe, modern.
const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-bodoni",
  style: ["normal", "italic"],
  weight: ["500", "600"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://solange.app"),
  applicationName: "SOLANGE",
  title: {
    default: "SOLANGE — La mode circulaire & connectée",
    template: "%s · SOLANGE",
  },
  description:
    "Inspire-toi, achète, revends. La marketplace sociale de la mode de seconde main. Chaque look est shoppable.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SOLANGE",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    siteName: "SOLANGE",
    locale: "fr_FR",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
  },
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1e9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      className={`${montserrat.variable} ${bodoni.variable} ${hanken.variable} antialiased`}
    >
      <body className="bg-noir text-bone">
        <SolangeProvider>
          <FeedThemeLock />
          <GrainOverlay />
          <CustomCursor />
          <AuthGate>
            <SideNav />
            <main className="md:pl-[88px]">{children}</main>
            <MobileTabBar />
          </AuthGate>
        </SolangeProvider>
      </body>
    </html>
  );
}
