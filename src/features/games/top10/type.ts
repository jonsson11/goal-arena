export type EntradaTop10 = {
  nombre: string;
  nacionalidad: string;
};

export type RankingTop10 = {
  id: string;
  titulo: string;
  descripcion?: string;
  respuestas: EntradaTop10[];
};