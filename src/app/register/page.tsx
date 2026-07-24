"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/features/auth/AuthContext";
import { GameButton } from "@/features/games/shared/GameButton";

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    login();
    router.push("/perfil");
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-primary/30 bg-card p-8 shadow-[0_0_30px_-8px_rgba(74,222,154,0.4)]"
      >
        <h1 className="text-center text-2xl font-extrabold text-foreground">
          Crear cuenta
        </h1>

        <div>
          <label className="mb-2 block text-sm font-semibold text-muted-foreground">
            Nombre de usuario
          </label>
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>

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

        <GameButton type="submit" className="mt-2">
          Crear cuenta
        </GameButton>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  );
}