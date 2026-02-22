# UX/UI: Leaderboards con muchos participantes

## Resumen del problema

Las quinielas pueden tener decenas, cientos o miles de participantes. Mostrar una lista enorme no escala bien y perjudica la experiencia (listas globales muy largas desmotivan, los números altos son difíciles de “sentir” y el scroll infinito puede afectar rendimiento).

## Fuentes y mejores prácticas

### 1. Mostrar “dónde estás tú” (UI-Patterns, Yahoo Patterns, UX Collective)

- **Mostrar la posición del usuario** y a quién tiene arriba y abajo.
- Objetivo: que el usuario siempre vea que puede subir (no solo a los inalcanzables del top).
- En nuestra implementación: **“Your position: #X of N”** cuando el usuario tiene entrada y no está en el top 5.

### 2. Top N fijo + contexto (UI-Patterns, gamificación)

- **Listar un número fijo de competidores** (ej. top 5 o 10), no toda la lista.
- Evitar una sola lista global gigante que desanime a la mayoría.
- En nuestra implementación: por defecto solo se muestran **los primeros 5** en la vista compacta.

### 3. Leaderboards contextuales (UX Collective, Stanislav Stankovic)

- Comparar con usuarios similares (mismo nivel, mismos amigos, misma quiniela).
- Dividir en grupos (p. ej. ~100) con leaderboards separados para que subir puestos sea más significativo.
- En nuestra app: cada **quiniela tiene su propio leaderboard** (contexto natural por pool).

### 4. Paginación vs. scroll infinito (Crocoblock, UX Patterns)

- **Paginación**: mejor cuando el usuario necesita posiciones concretas o volver a una página.
- **“Load more”**: equilibrio entre control del usuario y carga progresiva; evita cargar miles de filas de golpe.
- En nuestra implementación: **“Ver leaderboard completo”** abre una hoja con **paginación tipo “Load more”** (páginas de 50).

### 5. Evitar listas “élite” estáticas (UX Collective)

- Una lista donde solo los mismos están siempre arriba desmotiva al resto.
- En quinielas: la puntuación cambia por partidos, así que el ranking sí se mueve (puntuación “rápida” en el tiempo de la quiniela).

## Implementación en Futpools

| Práctica              | Aplicación                                                                 |
|-----------------------|----------------------------------------------------------------------------|
| Top N                 | Vista principal: solo **top 5** (param `top` en API).                     |
| Tu posición           | Si el usuario tiene entrada y no está en el top 5: **“You: #X of N”**.     |
| Total de participantes| Se muestra **“N participants”** para dar contexto sin listar a todos.   |
| Leaderboard completo  | Botón **“See full leaderboard”** → hoja con lista paginada (50 por página). |
| Auth opcional         | Con token: el backend devuelve `userEntry` (posición del usuario).        |

## Tabs dentro del detalle del Pool (QuinielaDetailView)

Para escalar a 10–12 partidos y muchos participantes, la pantalla de detalle del Pool usa **tabs in-page** (segmented control) con 3 secciones:

- **Overview**: resumen, premio, entrada, CTA “Join & Pick” / “Create Another Entry”, mensajes de estado.
- **Fixtures**: lista completa de partidos (scroll independiente).
- **Leaderboard**: tabla compacta (top 5 + tu posición + “Ver completo”).

Criterio (NN/G, Apple HIG): agrupar contenido largo en pocos bloques (3 tabs), reducir carga cognitiva, poner la acción principal en la pestaña por defecto (Overview). En iPhone se recomienda ≤5 segmentos; 3 es óptimo.

## Referencias

- [UI-Patterns: Leaderboard](https://ui-patterns.com/patterns/leaderboard)
- [Building better leaderboards (UX Collective)](https://uxdesign.cc/building-better-leaderboards-a5013d19cbd7)
- [Pagination vs. Infinite Scroll vs. Load More](https://crocoblock.com/blog/pagination-vs-infinite-scroll)
- SportFitnessApps / API-Sports docs (leaderboards en apps deportivas)
