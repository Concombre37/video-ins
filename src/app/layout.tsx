import { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "../../styles/global.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "HytLabs Studio",
  description: "Pubs vidéo HytLabs générées avec Claude et Remotion",
  icons: { icon: "/hytlabs-symbol.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0e0e17",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
