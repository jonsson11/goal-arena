export type Categoria = "valorDeMercado" | "goles" | "partidos" | "asistencias";

export const CATEGORIAS: Categoria[] = [
  "valorDeMercado",
  "goles",
  "partidos",
  "asistencias",
];

export const ETIQUETAS_CATEGORIA: Record<Categoria, string> = {
  valorDeMercado: "Valor de mercado (M€)",
  goles: "Goles",
  partidos: "Partidos jugados",
  asistencias: "Asistencias",
};