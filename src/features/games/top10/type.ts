export type EntradaTop10 = {
  nombre: string;
  nacionalidad: string;
  valor: number;
  /** Texto formateado a mostrar en vez de `valor` (ej. "40 años, 4 meses y 17 días"). */
  valorTexto?: string;
};

export type RankingTop10 = {
  id: string;
  titulo: string;
  descripcion?: string;
  respuestas: EntradaTop10[];
};