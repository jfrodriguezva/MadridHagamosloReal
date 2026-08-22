import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Madrid Hagámoslo Real",
  description: "Análisis, predicción y scouting del Real Madrid",
  // toma web/public/logos/monogram.png como favicon en cuanto lo coloques ahí
  icons: { icon: "/logos/monogram.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full">
      <head>
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=Source+Sans+3:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
