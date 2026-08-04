import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/features/auth/AuthContext";
import { SolicitudesProvider } from "@/features/social/SolicitudesContext";

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
  // Explícito en vez de depender de la convención especial `app/icon.png`
  // -- esa genera una ruta dinámica interna (/icon) que en este proyecto
  // estaba dando 404 en local (posible roce con el middleware, que corre
  // en toda ruta salvo las que acaban en extensión de imagen tipo ".png",
  // y "/icon" sin extensión no cuenta como tal). Apuntando aquí a un
  // archivo estático normal de public/ (que SÍ acaba en ".png" y por
  // tanto el middleware ni lo toca) nos ahorramos ese problema del todo.
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
          <Header />
          {children}
          <Footer />
         </SolicitudesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}