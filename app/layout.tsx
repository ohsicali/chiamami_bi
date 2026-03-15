import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "chiamami.bi — I migliori ristoranti consigliati",
  description: "Scopri i migliori ristoranti della tua città: mappa interattiva, foto, fasce di prezzo, stile di cucina e contatti.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
