import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/features/auth/AuthContext";
import { SolicitudesProvider } from "@/features/social/SolicitudesContext";
import { LogrosReclamablesProvider } from "@/features/profile/LogrosReclamablesContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Goal Arena",
  description: "Demuestra cuánto sabes de fútbol. En minutos.",
  icons: {
    icon: "/icon.png",
  },
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
        <AuthProvider>
         <SolicitudesProvider>
          <LogrosReclamablesProvider>
           <Header />
           {children}
           <Footer />
          </LogrosReclamablesProvider>
         </SolicitudesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}