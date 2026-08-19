import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/features/auth/AuthContext";
import { SolicitudesProvider } from "@/features/social/SolicitudesContext";
import { LogrosReclamablesProvider } from "@/features/profile/LogrosReclamablesContext";
import { ConsentimientoProvider } from "@/features/cookies/ConsentimientoContext";
import { CookieBanner } from "@/features/cookies/CookieBanner";
import { GoogleAdsenseScript } from "@/features/cookies/GoogleAdsenseScript";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ID de editor de AdSense (formato "ca-pub-XXXXXXXXXXXXXXXX"), definido en
// Vercel una vez se apruebe la cuenta -- hasta entonces queda undefined y
// tanto la meta tag de verificación de abajo como el script de
// GoogleAdsenseScript (ver ese archivo) se quedan inertes, sin tocar más
// código. La meta tag no depende de consentimiento de cookies: es solo
// una etiqueta de verificación de propiedad, no carga ningún recurso.
const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

export const metadata: Metadata = {
  title: "Goal Arena",
  description: "Demuestra cuánto sabes de fútbol. En minutos.",
  icons: {
    icon: "/icon.png",
  },
  ...(ADSENSE_CLIENT_ID
    ? { other: { "google-adsense-account": ADSENSE_CLIENT_ID } }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ConsentimientoProvider>
          <AuthProvider>
           <SolicitudesProvider>
            <LogrosReclamablesProvider>
             <Header />
             {children}
             <Footer />
             <CookieBanner />
             <GoogleAdsenseScript />
            </LogrosReclamablesProvider>
           </SolicitudesProvider>
          </AuthProvider>
        </ConsentimientoProvider>
      </body>
    </html>
  );
}
