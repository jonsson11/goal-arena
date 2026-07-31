"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/features/auth/AuthContext";
import { GameButton } from "@/features/games/shared/GameButton";

// Ruta a la que ir tras loguearse. Si alguien llega aquí porque intentó
// entrar a jugar sin sesión (ver NavLinks.tsx / HeroSection.tsx), llega
// como /login?redirect=/jugar y, al loguearse, se le manda directo ahí
// en vez de al perfil de siempre.
const DESTINO_POR_DEFECTO = "/perfil";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const destino = searchParams.get("redirect") || DESTINO_POR_DEFECTO;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const resultado = await login(email, password);
    setEnviando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    router.push(destino);
  }

  const hrefRegistro =
    destino === DESTINO_POR_DEFECTO ? "/register" : `/register?redirect=${encodeURIComponent(destino)}`;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-primary/30 bg-card p-8 shadow-[0_0_30px_-8px_rgba(74,222,154,0.4)]"
      >
        <h1 className="text-center text-2xl font-extrabold text-foreground">
          Iniciar sesión
        </h1>

        <div>
          <label className="mb-2 block text-sm font-semibold text-muted-foreground">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-muted-foreground">
            Contraseña
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-center text-sm font-semibold text-destructive">
            {error}
          </p>
        )}

        <GameButton type="submit" className="mt-2" disabled={enviando}>
          {enviando ? "Entrando..." : "Entrar"}
        </GameButton>

        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link href={hrefRegistro} className="font-semibold text-primary hover:underline">
            Regístrate
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
