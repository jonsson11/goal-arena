# Goal Arena — Roadmap de desarrollo

> Nombre de trabajo: **Goal Arena** (pendiente de decisión final de marca: Arena Golazo / Golito / etc. — no bloquea el desarrollo)

Checklist viva. Márcala con `[x]` a medida que completes tareas. Las estimaciones asumen desarrollo en tiempo parcial, aprendiendo sobre la marcha — son orientativas, no un compromiso.

---

## Fase 0 — Fundaciones ✅ (completada)

**Objetivo:** tener un proyecto profesional, versionado y desplegable, antes de escribir una sola línea de lógica de negocio.

- [x] Proyecto Next.js + TypeScript + Tailwind inicializado
- [x] Repositorio Git + GitHub
- [x] shadcn/ui instalado
- [x] Estructura de carpetas (`app/`, `components/`, `features/`, `lib/`)
- [x] Tablero Kanban (To do → In progress → Done)

**Resultado:** proyecto listo para desarrollar en serio.

---

## Fase 1 — Layout y navegación 🔄 (en curso — Sprint 3)

**Objetivo:** que la aplicación tenga una identidad visual y se pueda navegar entre secciones, sin lógica todavía.

- [x] Rutas base creadas: `/`, `/jugar`, `/social`, `/perfil`
- [x] `Navbar.tsx` con los 4 enlaces usando `Link`
- [x] Estilo del Navbar con Tailwind (logo centrado, distribución de enlaces)
- [x] `Footer.tsx` (iconos de redes sociales de la app)
- [x] `Header.tsx` revisado/integrado con el Navbar
- [x] Layout reutilizable (`layout.tsx` aplicando Header + Navbar + Footer a todas las páginas)
- [x] Responsive básico (mobile first, aunque el desarrollo inicial sea web)

**Resultado esperado:** al entrar en la web, "esto ya parece una aplicación de verdad", aunque no haga nada todavía.

**Estimación:** 1–2 semanas.

---

## Fase 2 — Sistema de diseño

**Objetivo:** componentes reutilizables y coherentes, para no reinventar estilos en cada pantalla.

- [x] Paleta de colores y tipografía definidas (`globals.css` — variables CSS)
- [ ] Componentes base: Button, Card, Input, Modal, Badge (ya hay varios vía shadcn — revisar cuáles faltan)
- [ ] Página `/design` como catálogo vivo de componentes (ya existe, mantenerla actualizada)
- [ ] Estados vacíos / loading / error definidos visualmente

**Resultado esperado:** cualquier pantalla nueva se puede montar con piezas ya existentes.

**Estimación:** 1 semana.

---

## Fase 3 — Primer minijuego jugable (3x3)

**Objetivo:** un juego funcionando de principio a fin, **sin backend**, con datos de ejemplo escritos a mano (hardcoded).

- [x] `features/games/grid/type.ts` — definir tipos (jugador, condición, tablero)
- [x] `features/games/grid/data.ts` — set de datos de prueba
- [x] Lógica de validación de respuesta (¿el jugador cumple ambas condiciones?)
- [x] UI del tablero 3x3 jugable
- [x] Contador de tiempo / puntuación básica
- [x] Pantalla de resultado al terminar

**Resultado esperado:** puedes jugar una partida real de 3x3 de principio a fin en `/jugar`.

**Estimación:** 2–3 semanas.

---

## Fase 4 — Resto de minijuegos (Individual)

**Objetivo:** completar el catálogo de minijuegos en modo Singleplayer, reutilizando los patrones aprendidos en el 3x3.

- [ ] Fichajes
- [x] Higher or Lower
- [ ] ADN
- [ ] Top 10
- [ ] XI
- [x] Selector de modo/dificultad/tiempo por juego (pantalla `/jugar` con selección visual de juego). A medias. Hay que perfilar esto.

**Resultado esperado:** los 6 minijuegos del documento de producto son jugables en solitario.

**Estimación:** 3–5 semanas (según se repita o no el patrón fácilmente).

---

## Fase 5 — Perfil (con datos simulados)

**Objetivo:** montar la pantalla de perfil con datos de mentira, antes de tener backend real.

- [ ] Nivel, experiencia, avatar (mock)
- [ ] Historial de partidas (mock)
- [ ] Estadísticas por minijuego (mock)
- [ ] Racha actual / máxima (mock)

**Resultado esperado:** el perfil ya tiene su diseño final, listo para conectar a datos reales más adelante.

**Estimación:** 1 semana.

---

## Fase 6 — Backend real: Supabase + Autenticación

**Objetivo:** pasar de datos simulados a datos persistentes y usuarios reales.

- [ ] Proyecto Supabase configurado
- [ ] Esquema de base de datos (usuarios, partidas, estadísticas, logros)
- [ ] Autenticación (email/password y/o proveedor social)
- [ ] API Routes propias para leer/escribir datos
- [ ] Conectar el perfil (Fase 5) a datos reales
- [ ] Guardar resultados de partidas jugadas

**Resultado esperado:** un usuario se registra, juega, y su progreso se guarda de verdad.

**Estimación:** 2–3 semanas (fase con más conceptos nuevos).

---

## Fase 7 — Progresión y logros

**Objetivo:** dar sentido al tiempo invertido por el jugador.

- [ ] Sistema de experiencia y niveles
- [ ] Desbloqueo de elementos cosméticos/insignias
- [ ] Logros (primera victoria, nivel 25, racha de 10 victorias, etc.)
- [ ] Notificación visual al desbloquear algo

**Estimación:** 1–2 semanas.

---

## Fase 8 — Modo 1vs1

**Objetivo:** el primer modo multijugador en tiempo real, más simple que las Arenas (2 jugadores en vez de hasta 8).

- [ ] Vs. aleatorio (matchmaking simple)
- [ ] Vs. amigo (crear sala / unirse con código)
- [ ] Sincronización del mismo reto para ambos jugadores
- [ ] Marcador en vivo

**Resultado esperado:** dos jugadores compiten a la vez en el mismo minijuego.

**Estimación:** 2–3 semanas (introduce tiempo real: websockets/Supabase Realtime).

---

## Fase 9 — Arenas multijugador

**Objetivo:** el modo núcleo de Goal Arena — salas de hasta 8 jugadores, varias rondas.

- [ ] Arena rápida (3 rondas) y clásica (5 rondas)
- [ ] Arena privada mediante código
- [ ] Clasificación provisional tras cada ronda
- [ ] Reparto de experiencia/recompensas al final

**Resultado esperado:** el grupo de amigos del bar puede montar una Arena real y jugarla entera.

**Estimación:** 3–4 semanas.

---

## Fase 10 — Social

**Objetivo:** la capa social que engancha (amigos, comparativas, rankings).

- [ ] Añadir/gestionar amigos
- [ ] Comparar estadísticas con amigos
- [ ] Ranking (aunque sea simple al principio)

**Estimación:** 1–2 semanas.

---

## Fase 11 — Pulido y MVP público

**Objetivo:** pasar de "funciona" a "presentable".

- [ ] Revisión responsive completa (mobile first de verdad)
- [ ] Manejo de errores y estados de carga en toda la app
- [ ] Rendimiento (imágenes, tiempos de carga)
- [ ] Deploy en Vercel con dominio definitivo
- [ ] Analítica básica (qué se usa, dónde se abandona)

**Estimación:** 2 semanas.

---

## Fase 12 — Post-MVP (ideas futuras, no bloqueantes)

- [ ] Sistema de energía + recuperación vía anuncios
- [ ] Modo competitivo por temporadas/divisiones
- [ ] Reto diario
- [ ] Monetización

---

## Cómo usar este documento

- Cada Fase equivale aproximadamente a un conjunto de Sprints.
- Dentro de cada sprint, las tareas se dividen en 🟢 obligatorias, 🟡 mejoras, 🔵 aprendizaje — tal como se acordó al principio.
- No se avanza a la siguiente fase con la anterior a medias, salvo excepciones acordadas explícitamente.
- Este documento se actualiza sesión a sesión, no es estático.
