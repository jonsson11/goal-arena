// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await crearClienteSupabaseServidor();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
