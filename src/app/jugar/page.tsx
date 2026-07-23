import Link from "next/link";
import { JUEGOS } from "@/features/games/shared/juegos";

export default function JugarPage() {
  return (
    <div className="flex flex-col items-center gap-8 p-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        Elige tu reto
      </h1>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
        {JUEGOS.map(({ href, nombre, descripcion, Icono, acento }) => (
          <Link
            key={href}
            href={href}
            className={`group relative flex flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center transition-all duration-200 hover:-translate-y-1 ${
              acento === "primary"
                ? "border-primary/30 hover:border-primary hover:shadow-[0_0_30px_-4px_rgba(74,222,154,0.5)]"
                : "border-secondary/30 hover:border-secondary hover:shadow-[0_0_30px_-4px_rgba(29,122,156,0.6)]"
            }`}
          >
            <Icono
              className={`h-16 w-16 transition-transform duration-200 group-hover:scale-110 ${
                acento === "primary" ? "text-primary" : "text-secondary"
              }`}
            />
            <span
              className={`text-xl font-bold ${
                acento === "primary" ? "text-primary" : "text-secondary"
              }`}
            >
              {nombre}
            </span>
            <span className="text-sm text-muted-foreground">{descripcion}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}