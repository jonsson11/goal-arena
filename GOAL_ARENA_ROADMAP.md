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

## Fase 3 — Primer minijuego jugable (3x3) ✅ (completada)

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

## Fase 3.5 — 3x3 conectado a datos reales ✅ (completada, con pulido pendiente)

**Objetivo:** que el 3x3 deje de depender de datos hardcoded y sea el primer minijuego totalmente "operativo" contra Supabase/Postgres. Esta fase se adelantó a la Fase 6 general porque surgió de forma natural al construir el buscador de jugadores.

**Buscador de jugadores (componente compartido)**
- [x] `features/games/shared/PlayerSearch.tsx` — combobox reutilizable con teclado completo, avatar/bandera, estado de carga y "sin resultados"
- [x] Soporta tanto datos locales (`players`) como búsqueda async (`onSearch`), para poder migrar de mock a BD real sin reescribir el componente
- [x] `excludeNames` + `hideExcluded` — jugadores ya colocados se muestran en rojo con etiqueta "Ya colocado" en vez de desaparecer
- [x] Corregidos warnings de "setState síncrono dentro de un efecto" — toda la lógica reactiva a eventos del usuario vive en manejadores de evento, no en `useEffect`

**Backend real para el 3x3**
- [x] `src/lib/prisma.ts` — singleton de `PrismaClient` con adapter-pg para el runtime de Next (Prisma 7)
- [x] `GET /api/jugadores/buscar` — busca jugadores reales en Postgres, mapea `Player` (Prisma) → `Jugador` (tipo de UI)
- [x] Búsqueda insensible a acentos también en la API real (antes solo funcionaba en el buscador local) — normalizador compartido en `src/lib/normalizarTexto.ts`, usado tanto por `PlayerSearch` como por la API route
- [x] `GET /api/tablero/generar` + `features/games/grid/generarTablero.server.ts` — genera el tablero 3x3 a partir de datos reales en vez de condiciones fijas
  - [x] Verifica intersección real de jugadores para condiciones equipo×equipo (no solo "existe algún jugador", sino "hay un jugador que jugó en AMBOS clubes")
  - [x] Nunca genera selección×selección (una fila siempre es equipo/club; la nacionalidad solo puede aparecer en columnas)
  - [x] Filtro por nombre para descartar equipos filiales/juveniles (`U21`, `Sub-XX`, `Jong`, `Primavera`, reservas...) — aplicado tanto a `Team.nombre` como a `Player.nacionalidad`
  - [x] Intento de diversificar filas por país (parche estadístico, no garantía — limitado por lo poco sincronizado que está el cruce entre ligas ahora mismo)
- [x] `features/games/grid/indiceEquipos.server.ts` — índice compartido (equipo↔jugador↔nacionalidad) usado tanto por el generador como por la comprobación de soluciones
- [x] `POST /api/tablero/contar-soluciones` — dado un lote de celdas (condición fila + columna), devuelve cuántos jugadores reales cumplen cada una, y sus nombres
- [x] Autocompletado de solución única: si el jugador colocado también es la ÚNICA solución posible para otra casilla vacía del mismo tablero, esa casilla se marca sola con un mensaje explicativo (comprobación por celda, no asume solución única global del tablero)
- [x] Panel de depuración (solo fuera de producción, `NODE_ENV !== "production"`): desplegable en cada casilla vacía con el nº de soluciones y el listado de nombres — para poder verificar el punto anterior sin depender de la suerte jugando

**Resultado esperado:** el 3x3 es jugable de principio a fin contra datos reales de la BD, con tableros generados dinámicamente y validados contra intersecciones reales de jugadores.

### Pendiente / pulido de esta fase

- [ ] **Bug de acentos especiales:** "Leo Østigård" no aparece al buscar "Ostigard" — el normalizador actual (`normalizarTexto.ts`) solo quita diacríticos combinables (tildes, diéresis...) vía `NFD`, pero no cubre caracteres nórdicos que no se descomponen así (Ø, Å, Æ, Ð...). Hay que ampliar el normalizador con un mapa de sustitución manual para esos casos.
- [ ] **Diseño final del tablero** (pendiente de pulido visual, sigue el patrón de diseño del resto de la página):
  - Casillas acertadas: glow verde redondeado en vez del borde plano actual; casillas cuadradas (revisar proporciones).
  - Incorporar imágenes reales: escudos de equipo/selección y foto del jugador dentro de la casilla, junto al nombre, en cuanto se acierta la respuesta (ahora mismo solo se ve el nombre en texto).
- [ ] **Mensajes residuales al terminar partida:** el último mensaje mostrado durante la partida (p. ej. "Anthony Elanga colocado correctamente") se queda visible tras completar o rendirse — debe desaparecer al mostrarse el diálogo de resultado (`GameResultDialog`).
- [ ] Evaluar si merece la pena limitar cuántas columnas de tipo "nacionalidad" puede tener un tablero (1 o 2 máximo) para no rebajar demasiado la dificultad — aparcado a propósito hasta ver cómo se comporta el generador con más ligas sincronizadas.
- [ ] Root cause de fondo sin resolver: `extraerEtapas()` en `wikipediaSync.ts` no distingue el bloque de carrera de club del bloque de selección nacional en el infobox de Wikipedia — el filtro por nombre en el generador es un parche necesario mientras tanto, pero no ataca la causa raíz del sync.

---

## Fase 4 — Resto de minijuegos (Individual)

**Objetivo:** completar el catálogo de minijuegos en modo Singleplayer, reutilizando los patrones aprendidos en el 3x3 — incluido, ahora, el patrón de conectar un juego a datos reales (buscador + generador + validación server-side) que se estableció en la Fase 3.5.

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

- [x] Proyecto Supabase configurado
- [x] Esquema de base de datos (usuarios, partidas, estadísticas, logros) — `prisma/schema.prisma`, migraciones aplicadas
- [ ] Autenticación (email/password y/o proveedor social) — sigue con `AuthContext` mock
- [x] API Routes propias para leer/escribir datos — hechas para el 3x3 (`/api/jugadores/buscar`, `/api/tablero/generar`, `/api/tablero/contar-soluciones`); falta para el resto de juegos y para perfil/social
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

## Backlog transversal (no ligado a una fase concreta)

- [ ] **Imágenes de jugadores y escudos de equipo.** Ahora mismo `Team.escudo` existe en el schema pero no está claro de dónde sale un set fiable de imágenes reales (ni de jugadores ni de escudos) que se pueda usar libremente. Pendiente decidir fuente (¿API-Football tiene URLs de imágenes en el tier gratuito? ¿Wikipedia/Wikimedia Commons con su propia licencia por imagen? ¿Un CDN propio subiendo los assets a mano?) antes de poder implementar nada — bloquea directamente el punto de diseño final del 3x3 (Fase 3.5) y, a futuro, cualquier pantalla de perfil/social que muestre jugadores o escudos.

---

## Cómo usar este documento

- Cada Fase equivale aproximadamente a un conjunto de Sprints.
- Dentro de cada sprint, las tareas se dividen en 🟢 obligatorias, 🟡 mejoras, 🔵 aprendizaje — tal como se acordó al principio.
- No se avanza a la siguiente fase con la anterior a medias, salvo excepciones acordadas explícitamente.
- Este documento se actualiza sesión a sesión, no es estático.