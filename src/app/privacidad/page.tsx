import type { Metadata } from "next";
import Link from "next/link";
import { TituloPagina } from "@/components/layout/TituloPagina";

export const metadata: Metadata = {
  title: "Política de privacidad — Goal Arena",
  description: "Cómo trata Goal Arena tus datos personales.",
};

// Página estática (Server Component, sin "use client") -- es contenido
// legal que no depende de sesión ni de estado en cliente, así que no hay
// motivo para pagar el coste de hidratación de un Client Component. La
// fecha de "última actualización" se pasa a mano abajo porque
// `new Date()` en build time fijaría la fecha del último deploy, no la de
// la última vez que se revisó de verdad el texto legal.
const ULTIMA_ACTUALIZACION = "19 de agosto de 2026";

export default function PoliticaPrivacidadPage() {
  return (
    <div className="relative z-10 mx-auto flex max-w-3xl flex-col gap-6 px-6 pb-16 pt-4 sm:pt-6">
      <TituloPagina hrefAtras="/">Política de Privacidad</TituloPagina>

      <p className="text-sm text-muted-foreground">Última actualización: {ULTIMA_ACTUALIZACION}</p>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-foreground/90 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <section>
          <h2>1. Quién es el responsable</h2>
          <p>
            Goal Arena es un proyecto personal, sin constitución de empresa. El responsable del
            tratamiento de tus datos es la persona titular del proyecto. Puedes contactar por
            correo electrónico a través de{" "}
            <a href="mailto:goalarenasupport@gmail.com" className="text-primary underline underline-offset-2">
              goalarenasupport@gmail.com
            </a>{" "}
            para cualquier consulta relacionada con tus datos.
          </p>
        </section>

        <section>
          <h2>2. Qué datos tratamos</h2>
          <ul>
            <li>
              <strong className="text-foreground">Datos de cuenta:</strong> nombre de usuario,
              correo electrónico y contraseña (cifrada, no la vemos en texto plano) al registrarte.
            </li>
            <li>
              <strong className="text-foreground">Datos de perfil:</strong> avatar (incluida una
              foto si decides subir una), nivel, experiencia, estadísticas e historial de partidas.
            </li>
            <li>
              <strong className="text-foreground">Datos de relación social:</strong> tu lista de
              amigos y solicitudes de amistad, si usas la sección Social.
            </li>
            <li>
              <strong className="text-foreground">Datos técnicos:</strong> dirección IP y cookies
              necesarias para mantener tu sesión iniciada, y (si das tu consentimiento) cookies de
              anuncios de Google AdSense — ver nuestra{" "}
              <Link href="/cookies" className="text-primary underline underline-offset-2">
                política de cookies
              </Link>{" "}
              para el detalle completo.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Con qué finalidad los tratamos</h2>
          <ul>
            <li>Crear y gestionar tu cuenta, y guardar tu progreso de juego.</li>
            <li>Mostrarte tus estadísticas, nivel e historial de partidas en tu perfil.</li>
            <li>Permitirte añadir amigos y jugar partidas multijugador con ellos.</li>
            <li>Mantener tu sesión iniciada entre visitas.</li>
            <li>
              Mostrar anuncios (solo si has dado tu consentimiento a cookies de anuncios) para
              poder mantener Goal Arena gratuito.
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Base legal</h2>
          <p>
            El tratamiento de los datos de cuenta y de juego se basa en la ejecución del servicio
            que nos pides al registrarte (art. 6.1.b RGPD). El tratamiento de cookies no esenciales
            (anuncios) se basa en tu consentimiento explícito (art. 6.1.a RGPD), que puedes retirar
            en cualquier momento desde el enlace &quot;Gestionar cookies&quot; del pie de página.
          </p>
        </section>

        <section>
          <h2>5. Con quién compartimos tus datos</h2>
          <p>
            Usamos proveedores externos para poder ofrecer el servicio: Supabase (base de datos,
            autenticación y almacenamiento de imágenes de perfil), Vercel (alojamiento), y, si has
            dado tu consentimiento, Google AdSense (anuncios). No vendemos tus datos a terceros ni
            los usamos con fines distintos a los descritos aquí.
          </p>
        </section>

        <section>
          <h2>6. Cuánto tiempo conservamos tus datos</h2>
          <p>
            Mientras mantengas tu cuenta activa. Si eliminas tu cuenta, borramos tus datos
            personales y de perfil; puede quedar información agregada y anónima (por ejemplo,
            estadísticas de uso sin identificar a nadie) que no permite identificarte.
          </p>
        </section>

        <section>
          <h2>7. Tus derechos</h2>
          <p>
            Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación
            y portabilidad de tus datos escribiendo a{" "}
            <a href="mailto:goalarenasupport@gmail.com" className="text-primary underline underline-offset-2">
              goalarenasupport@gmail.com
            </a>
            . También tienes derecho a presentar una reclamación ante la Agencia Española de
            Protección de Datos (
            <a
              href="https://www.aepd.es"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              aepd.es
            </a>
            ) si consideras que el tratamiento no se ajusta a la normativa.
          </p>
        </section>

        <section>
          <h2>8. Cambios en esta política</h2>
          <p>
            Podemos actualizar esta política a medida que Goal Arena añada funcionalidades nuevas.
            Si el cambio es relevante, lo indicaremos en esta misma página con la fecha de
            actualización.
          </p>
        </section>
      </div>
    </div>
  );
}

