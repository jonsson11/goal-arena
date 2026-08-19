"use client";

// src/app/cookies/page.tsx
//
// A diferencia de /privacidad, esta página sí necesita ser Client Component:
// el botón "Gestionar preferencias" reabre el banner leyendo/escribiendo el
// mismo ConsentimientoContext que usa el banner y el footer, para que
// cambiar de opinión no dependa de borrar cookies a mano en el navegador.

import { TituloPagina } from "@/components/layout/TituloPagina";
import { GameButton } from "@/features/games/shared/GameButton";
import { useConsentimiento } from "@/features/cookies/ConsentimientoContext";

const ULTIMA_ACTUALIZACION = "19 de agosto de 2026";

export default function PoliticaCookiesPage() {
  const { estado, abrirPreferencias } = useConsentimiento();

  return (
    <div className="relative z-10 mx-auto flex max-w-3xl flex-col gap-6 px-6 pb-16 pt-4 sm:pt-6">
      <TituloPagina hrefAtras="/">Política de Cookies</TituloPagina>

      <p className="text-sm text-muted-foreground">Última actualización: {ULTIMA_ACTUALIZACION}</p>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p className="font-semibold text-foreground">Tu decisión actual</p>
          <p className="text-muted-foreground">
            {estado === undefined && "Cargando..."}
            {estado === null && "Todavía no has decidido."}
            {estado?.decision === "aceptado" && "Has aceptado las cookies de anuncios."}
            {estado?.decision === "rechazado" && "Has rechazado las cookies de anuncios."}
          </p>
        </div>
        <GameButton type="button" onClick={abrirPreferencias} className="shrink-0">
          Gestionar preferencias
        </GameButton>
      </div>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-foreground/90 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:border-b [&_th]:border-border [&_th]:pb-2 [&_th]:pr-4 [&_th]:font-semibold [&_th]:text-foreground [&_td]:border-b [&_td]:border-border/60 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top [&_td]:text-muted-foreground">
        <section>
          <h2>¿Qué es una cookie?</h2>
          <p>
            Una cookie es un pequeño archivo que se guarda en tu dispositivo cuando visitas una
            web, y que permite recordar información entre visitas (como que has iniciado sesión) o
            personalizar lo que ves. Algunas de las cookies que usamos son técnicas de
            localStorage, no cookies HTTP en el sentido estricto, pero cumplen la misma función y
            se explican aquí bajo el mismo nombre por simplicidad.
          </p>
        </section>

        <section>
          <h2>Cookies necesarias (siempre activas)</h2>
          <p>
            Imprescindibles para que Goal Arena funcione. No se pueden desactivar porque el sitio
            depende de ellas — no requieren tu consentimiento según la normativa.
          </p>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Proveedor</th>
                <th>Finalidad</th>
                <th>Duración</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>sb-*-auth-token</td>
                <td>Supabase (propia)</td>
                <td>Mantener tu sesión iniciada</td>
                <td>~1 semana</td>
              </tr>
              <tr>
                <td>goalarena_consentimiento_cookies</td>
                <td>Goal Arena (propia)</td>
                <td>Recordar tu decisión sobre esta misma política de cookies</td>
                <td>Sin caducidad (hasta que la borres)</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Cookies de anuncios (requieren tu consentimiento)</h2>
          <p>
            Usamos Google AdSense para mostrar anuncios y poder mantener Goal Arena gratuito. Si
            aceptas, Google puede instalar cookies para mostrar anuncios personalizados según tu
            actividad; si rechazas, no se cargará ningún script de anuncios personalizados. Puedes
            cambiar tu decisión en cualquier momento con el botón de arriba o desde el enlace
            &quot;Gestionar cookies&quot; del pie de página.
          </p>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Proveedor</th>
                <th>Finalidad</th>
                <th>Duración</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>__gads / __gpi / IDE, entre otras</td>
                <td>Google AdSense (google.com)</td>
                <td>Mostrar y medir anuncios personalizados</td>
                <td>Hasta 13 meses</td>
              </tr>
            </tbody>
          </table>
          <p>
            Más información en la{" "}
            <a
              href="https://policies.google.com/technologies/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              política de anuncios de Google
            </a>
            .
          </p>
        </section>

        <section>
          <h2>¿Cómo puedo borrar las cookies ya guardadas?</h2>
          <p>
            Además de gestionar tu preferencia con el botón de arriba, puedes borrar cookies y
            datos de sitios en cualquier momento desde la configuración de tu navegador.
          </p>
        </section>
      </div>
    </div>
  );
}
