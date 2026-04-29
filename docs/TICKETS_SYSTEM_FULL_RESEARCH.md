# Investigación: Premios reales (tarjetas Amazon, mercancía) en una iOS app de quinielas

## Contexto

Como dueño de la iOS app **Futpools**, quieres saber si puedes ofrecer premios del mundo real — específicamente tarjetas de regalo Amazon (~$250 MXN) y/o bienes materiales — a los participantes de las quinielas, tomando como referencia que **Quiniela Pro** aparentemente lo hace. Esto tiene tres dimensiones que se cruzan:

1. **Políticas de Apple App Store** (¿lo permite la guideline 5.3?)
2. **Ley mexicana** (¿requiere permiso de SEGOB? ¿qué retención fiscal aplica?)
3. **Modelo operativo realista** (¿cómo lo hacen sin que los rechacen ni los multen?)

El propósito de este documento es darte una imagen completa para decidir **si** y **cómo** ofrecer premios, antes de tocar una sola línea de código en la app.

---

## Modelo actual de Futpools (clarificado por el usuario)

Futpools tiene **una sola moneda virtual ("Coins") que se compra con IAP de Apple**. El usuario gasta Coins para entrar a quinielas y, si gana, hoy quiere recibir tarjeta Amazon o mercancía. **Este modelo, tal cual, NO es viable** — choca de frente con Apple Guideline 5.3.3 ("Apps may not use in-app purchase to purchase credit or currency for use in conjunction with real money gaming of any kind") y con la LFJS mexicana (la compra de Coins es contraprestación, el premio Amazon es valor real, el resultado deportivo es evento incierto = sorteo que requiere permiso pleno SEGOB).

**La salida es desacoplar la economía con un modelo de DOS MONEDAS** (igual que Mistplay, Lucktastic, PCH Sweepstakes — y estructuralmente similar al "Coins + Bonus" de WebNovel/GoodNovel/ReelShort/DramaBox):

- **Coins** (IAP, comprables): para features cosméticos, ligas privadas premium, badges, boosts de UX. **NUNCA se canjean por entrar a un pool con premio real, ni se convierten en Tickets.**
- **Tickets** (NO comprables bajo ninguna circunstancia): única forma de entrar a quinielas con premio real. Solo se ganan dentro de la app por: daily check-in (crítico), rewarded ads (cap diario), referrals, misiones de engagement, eventos especiales tipo "rueda de la fortuna" diaria gratis.

Con ese diseño, el modelo cae en **Apple Guideline 5.3.1–5.3.2 (sweepstakes/contests)**, NO en 5.3.4 (real money gaming). Probabilidad estimada de aprobación en App Review: **70–85%**, condicionado a una "wall" absoluta entre las dos monedas (ver §4 Camino B+ y §6).

---

## TL;DR — Respuestas rápidas

1. **¿Puedes ofrecer tarjetas de Amazon como premio?** Sí, si rediseñas la economía con dos monedas separadas. Apple no prohíbe entregar tarjetas de regalo o mercancía como premio en sí; lo que prohíbe es **venderlas vía IAP** y prohíbe que **una moneda comprada con IAP sirva para entrar a un concurso con premio real**. La línea roja absoluta es: **Coins (IAP) ↔ Tickets (premio real) sin conexión, en código y en UI**.

2. **¿Quiniela Pro realmente entrega premios?** **No oficialmente.** Sus TOS lo dicen literal: "no es plataforma de apuestas, no distribuye premios". Las tarjetas Amazon son marketing informal — exactamente lo que provoca las reseñas negativas de usuarios que dicen "gané pero nunca me contactaron". Si tú quieres entregar premios formalmente, debes hacerlo distinto que ellos.

3. **Precedentes vivos del modelo dual**: **Mistplay** (App Store ID 6739352969, categoría Entertainment, 18+), **Lucktastic**, **PCH Sweepstakes**, **Solitaire Cube / Skillz** (ID 1114214294, depósitos vía PayPal/Apple Pay, NO Apple IAP), **HQ Trivia** cuando estaba viva. Todas con doble economía, premios reales, aprobadas. Para coins-cosméticos: WebNovel/GoodNovel/ReelShort/DramaBox son el playbook de UX dual currency (categorías Books/Entertainment, NUNCA Games).

4. **Daily check-in es el componente más crítico**: es tu **AMOE (Alternative Method of Entry)** — la prueba legal de que el sorteo NO requiere compra. Sin AMOE robusto (un tap diario que da ticket sin necesidad de ver ad ni gastar nada), Apple puede recategorizar tu modelo como real money gaming, y la LFJS lo trata como sorteo con consideration → permiso pleno SEGOB.

5. **México sigue requiriendo permiso de sorteo con fines promocionales** ante DGJS-SEGOB, aunque sea gratuito. Trámite accesible, derechos federales + 3% aprovechamiento sobre valor de premios. Más retención fiscal 1% federal + ~6% estatal sobre el premio (que tú absorbes) + CFDI de retenciones al ganador.

6. **Recomendación honesta**: antes de implementar, **consulta con un abogado mexicano especialista en regulación de juegos y sorteos** ($5,000–$15,000 MXN por opinión inicial). El costo es marginal frente al riesgo: multas administrativas, decomiso, bloqueo del sitio coordinado por IFT, y en casos graves imputación penal bajo el art. 257 del Código Penal Federal.

---

## 1. Reglas de Apple — App Store Review Guidelines, Sección 5.3

Texto literal de https://developer.apple.com/app-store/review/guidelines/ (vigente abril 2026):

| # | Regla | Implicación para Futpools |
|---|---|---|
| **5.3.1** | "Sweepstakes and contests must be sponsored by the developer of the app." | El sponsor del concurso debe ser **Futpools** (o un patrocinador identificado); no los usuarios. Pots colectivos de los participantes no califican. |
| **5.3.2** | "Official rules for sweepstakes, contests, and raffles must be presented in the app and make clear that Apple is not a sponsor or involved in the activity in any manner." | Bases del concurso **dentro de la app** (no solo link), con disclaimer textual: *"Apple no es patrocinador ni está involucrada en este concurso."* |
| **5.3.3** | "Apps may not use in-app purchase to purchase credit or currency for use in conjunction with real money gaming of any kind." | Si cobras cuota para entrar al pool, **no puede ser vía IAP de Apple**. Tendría que ser Stripe / Mercado Pago / OXXO / Apple Pay-no-IAP. |
| **5.3.4** | "Apps that offer real money gaming… must have necessary licensing and permissions in the locations where the app is used, must be geo-restricted to those locations, and must be free on the App Store." | Si Apple lo clasifica como "real money gaming": app gratis, geo-restringida a MX, licencia SEGOB obligatoria. |

### Hallazgos clave sobre Apple

- **No existe sección "3.1.5(b) Sweepstakes and Contests"** en las guidelines vigentes; toda la regulación está en 5.3.
- Apple **no reconoce textualmente "skill-based" como excepción**. La trinidad que activa "real money gaming" es **consideration + chance + prize**. Si los tres están presentes, cae en 5.3.4 — incluso si tú argumentas que es habilidad.
- **Tarjetas Amazon o mercancía como premio no son problema en sí**. Lo prohibido es venderlas dentro de la app por IAP. Entregarlas como premio gratuito es aceptable si el modelo de concurso cumple 5.3.
- **Categoría App Store importa**: Quiniela Pro está en "Entretenimiento" (no Sports/Games), lo que reduce escrutinio bajo 5.3. Splash Sports (US, real money gaming) está en Sports con edad 18–21+.
- No hay mecanismo de pre-aprobación con Apple. Se descubre en App Review.

---

## 2. Marco legal mexicano — Ley Federal de Juegos y Sorteos (LFJS) y fiscal

### 2.1 ¿Cae mi quiniela bajo la LFJS?

- **Con cuota de inscripción**: **sí, casi seguro**. La LFJS (DOF 1947) y su Reglamento (DOF 2004) definen "sorteo" de forma muy amplia: cualquier actividad donde el participante, mediante contraprestación, tiene oportunidad de obtener un premio cuya determinación depende del azar o de un evento futuro incierto. La quiniela deportiva históricamente cabe en "sorteo de pronósticos deportivos".
- **Sin cuota**: aún técnicamente cae como "sorteo con fines promocionales" — sí requiere permiso, pero el trámite es accesible.
- **Concurso de habilidad puro** (sin componente de azar): sin permiso. Pero la autoridad mexicana (DGJS-SEGOB) ha sido **restrictiva**: rara vez acepta que una quiniela deportiva sea pura habilidad, especialmente con cuota.

### 2.2 Permiso de SEGOB

- **Autoridad**: Dirección General de Juegos y Sorteos (DGJS) de SEGOB. Verificar URL vigente en 2026 en gob.mx/segob.
- **Permiso pleno de juegos con apuestas**: requiere capital social demostrable, fianza, infraestructura, antecedentes. Trámite de meses/años. **No viable para emprendedor individual**.
- **Permiso de sorteo con fines promocionales**: trámite simplificado, semanas. Pago de derechos federales + **aprovechamiento del 3% sobre el valor total de los premios** a SEGOB.

### 2.3 Implicaciones fiscales (LISR arts. 137–139)

- **El ganador es sujeto del impuesto, el organizador es retenedor.**
- **Retención federal**: 1% sobre valor del premio (sube a 21% si la entidad federativa grava por encima del 6%, lo cual es raro).
- **Retención estatal**: típicamente 6% (varía por entidad — CDMX, EdoMex, Jalisco, NL están en ese rango).
- **Premio en especie** (tarjeta Amazon, mercancía): el organizador no puede retener "del premio" — en la práctica **lo absorbe** y entera al SAT.
  - Ejemplo para tarjeta Amazon de $250 MXN: ~$2.50 federal + ~$15 estatal = ~$17.50 MXN absorbidos por Futpools.
- **CFDI de retenciones** obligatorio al ganador.
- **IEPS 30%** aplica si estás en régimen de juegos con apuestas (típicamente NO aplica a sorteos promocionales chicos).

### 2.4 Profeco / consumidor

- Las **bases del concurso** deben publicarse y ser accesibles **antes** de la participación: identidad del organizador (RFC/domicilio), mecánica completa, premios, vigencia, cobertura geográfica, restricciones, mecanismo de selección y notificación, plazo de entrega, tratamiento fiscal, aviso de privacidad LFPDPPP.
- LFPC arts. 32, 46, 47 son los aplicables a publicidad y promociones.

### 2.5 Riesgos prácticos

- **LFJS art. 12**: multas administrativas en UMAs, clausura.
- **Código Penal Federal art. 257**: hasta 2 años de prisión + multa por organizar juegos prohibidos. Aplicación selectiva, pero existe.
- **IFT** puede coordinar bloqueo de sitios sin permiso.
- Decomiso de premios y equipos.

---

## 3. Cómo lo hacen las apps existentes

| App | Mercado | Entry fee | Premio | Estructura legal | Quien fondea | Cat. App Store |
|---|---|---|---|---|---|---|
| **Quiniela Pro** | MX | Gratis + créditos IAP | Tarjeta Amazon **promocional/informal** ("ganaste pero no te contactaron") | **Disclaimer en TOS: "no entregamos premios"** | N/A oficialmente | Entretenimiento, 4+ |
| **EasyFutbol** | MX | Gratis | Cero — admins arreglan privadamente | Idéntico a Quiniela Pro | N/A | iOS + web |
| **Barush Sports** | MX | Gratis | $1,000 MXN Amazon/sem + jerseys | Sin disclosures formales (web only) | Patrocinador (concesionario seminuevos) | Web, no app |
| **Futbol Online** | MX | B2B (paga la empresa cliente) | Define el cliente corporativo | Pasa responsabilidad al cliente | Empresa-cliente | Web + app |
| **ESPN Pick'em** (Miller Lite) | US | Gratis | $10K cheque | **Sweepstakes** con "NO PURCHASE NECESSARY" + drawing aleatorio | Patrocinador (Miller Lite) | Sports |
| **Yahoo Fantasy NBC** | US | Gratis | $1M | Sweepstakes con NPN | Yahoo + NBC | Sports |
| **CBS Pick'em** | US | Gratis | $1K/sem + $100K | **Concurso de habilidad gratuito** + disclaimer Apple | CBS Interactive | Sports, 21+ |
| **Splash Sports** | US | $5–$1,000+ | Cash garantizado >$5M | Real money gaming licenciado por estado | Pool de participantes | Sports, 18–21+, geo-restringida ~28 estados, **no en MX** |

### Patrón clave: **el modelo Quiniela Pro funciona porque NO entrega premios oficialmente**

Su categoría (Entretenimiento, 4+, sin geo-restricción) y el hecho de que esté vivo desde 2018 confirman que el disclaimer "no somos plataforma de premios" funciona ante App Review. La tarjeta Amazon que mencionan es marketing informal — no estructural. Si tú la haces estructural, tienes que formalizarla (bases, permiso, retención fiscal, CFDI).

---

## 4. Caminos viables para Futpools (ordenados por riesgo ascendente)

### Camino A — "Plataforma neutral" (modelo Quiniela Pro / EasyFutbol)

**Qué haces**: La app **nunca entrega premios**. Los pools son herramientas; cualquier acuerdo de premio entre amigos es 100% privado, fuera de la app. Lo declaras explícitamente en TOS.

- **Ventajas**: No cae bajo LFJS. No requiere permiso SEGOB. App Store cat. Entretenimiento sin geo-restricción. Modelo monetizable vía IAP de créditos + B2B corporativo.
- **Desventajas**: No puedes anunciar "gana premios" como diferenciador (te expones al mismo problema de Quiniela Pro: usuarios que esperan premios y no los reciben → reseñas negativas → posible queja a Profeco).
- **Riesgo**: Bajo, siempre que el disclaimer sea fuerte y no se contradiga con marketing.

### Camino B — "Sweepstakes promocional" (modelo Barush Sports / ESPN+Miller Lite)

**Qué haces**: La app sí promete premios, pero estructurados como **sorteo/concurso promocional patrocinado por Futpools (o un sponsor)**:
- Entrada **gratis** al pool premiado (puedes seguir cobrando créditos IAP por ligas privadas más grandes, pero **el premio no depende de pago**).
- Premio fondeado por Futpools o un sponsor identificado.
- Bases del concurso **embebidas en la app** con todos los elementos del 2.4.
- Disclaimer explícito "Apple no es patrocinador" (cumple 5.3.2).
- Restricciones: 18+, residencia MX, exclusión empleados/familia/proveedores.
- Tramitar **permiso de sorteo con fines promocionales** ante DGJS (3% de aprovechamiento + derechos).
- Retener ISR (1% federal + ~6% estatal), absorber el impuesto, emitir CFDI al ganador.
- Mecánica con peso de **habilidad**: marcador exacto, rankings acumulados, ponderaciones por consistencia (esto te ayuda en cualquier defensa).

- **Ventajas**: Modelo limpio, replicable por temporada (Liga MX, Champions, Mundial). Cumple Apple 5.3.1–5.3.2. Defendible ante DGJS porque tienes permiso. Marketing real ("gana una tarjeta Amazon de $250 MXN cada semana").
- **Desventajas**: Costo operativo (permisos, contabilidad fiscal, CFDIs). Requiere disciplina legal-administrativa.
- **Riesgo**: Bajo-medio. Es el camino que recomienda la práctica regulatoria mexicana para apps similares.

### Camino B+ — "Doble moneda: Coins (IAP) + Tickets (earnable)" — RECOMENDADO

Mantienes la economía de Coins que ya tiene Futpools y le sumas un sistema de Tickets para los pools premiados. Es la combinación de Camino B (sweepstakes promocional) con el playbook de Mistplay/Lucktastic/PCH/Skillz adaptado.

**Diseño de las dos monedas:**

| | **Coins** (IAP) | **Tickets** (earnable) |
|---|---|---|
| Cómo se obtienen | Compra con IAP de Apple (packs $0.99 → $99.99) | Solo earnable: daily check-in, rewarded ads (cap), referrals, misiones, eventos diarios |
| Para qué sirven | Ligas privadas premium, badges cosméticos, boosts UX, temas, avatares, regalos a amigos | **Única** entrada a quinielas con premio real (tarjeta Amazon, mercancía) |
| ¿Se convierten entre sí? | **NO. En ninguna dirección. En ningún caso.** | **NO. Ni con suscripción, ni con bundle, ni con descuento.** |
| ¿Aparecen juntas en una pantalla? | Solo en el balance del usuario (separadas visualmente). **Nunca en el flow de "entrar a quiniela premiada".** | Solo en el flow de quinielas premiadas. **Nunca aparece "Coins" como opción alternativa.** |
| Caducidad | No expiran (o 12 meses inactividad) | Expiran al cierre del sorteo correspondiente |
| Cesión a otros usuarios | Permitido como gift cosmético | **No transferibles** |

**Mecanismos de earning de Tickets** (combinar varios; daily check-in es OBLIGATORIO como AMOE):

| Mecanismo | Recompensa típica | Cap diario | Riesgo Apple | Función legal |
|---|---|---|---|---|
| **Daily check-in** | 1 ticket o fracción/día | 1 tap | Bajo | **AMOE crítico** — debe permitir entrar al menos a un sorteo/mes sin hacer NADA más |
| **Rewarded ads** | 1 ticket por 3–5 ads | 3–5 ads/día | Medio si es la única vía | Boost; nunca exclusivo |
| **Referral exitoso** | 50–200 tickets | sin cap por usuario referido | Bajo | Growth |
| **Misiones engagement** | 5–50 tickets ("contesta 5 partidos", "comenta en 3 ligas") | 1–2 misiones/día | Bajo | Retención |
| **Compartir en RRSS** | 10–20 tickets | 1/día | Bajo | Growth |
| **Activar notificaciones** | 30 tickets | one-time | Bajo | Onboarding |
| **Login social** | 20 tickets | one-time | Bajo | Onboarding |
| **Cumpleaños** | 50–100 tickets | 1/año | Bajo | Retención |
| **Rueda de la fortuna diaria** (1 spin gratis) | 1–10 tickets random | 1 spin/día | Bajo si es realmente gratis y no hay spins comprables | Gamification |
| **Encuestas / surveys** | 50–200 tickets | 1–2/día | Bajo-medio | Secundario |
| ❌ Reviews en App Store | — | — | **PROHIBIDO 3.2.2** | Nunca |
| ❌ Suscripción IAP que dé Tickets | — | — | **CRÍTICO — recategorización a 5.3.4** | Nunca |
| ❌ Convertir Coins → Tickets | — | — | **CRÍTICO — recategorización a 5.3.4** | Nunca |
| ❌ Bundle "compra Coins + recibe Tickets" | — | — | **CRÍTICO — recategorización a 5.3.4** | Nunca |
| ⚠️ Offerwall (Tapjoy "instala este juego = 1 ticket") | — | — | Medio-alto cuando lleva a premio real | Evitar |

**Calibración económica sugerida** (para premio Amazon $250 MXN ≈ $14 USD):
- 1 ticket = ~5–10 rewarded ads (costo eCPM ~$0.005–0.015 USD/ad).
- 1 ticket = 1 daily check-in.
- Cap diario total de tickets ganables: 3–5 (evita sybil farming y dilución del sorteo).
- Si N participantes en el sorteo, EV/ticket = $14/N. Tu margen viene de ventas de Coins (canal independiente).

**Reglas de UI/Code (la "wall" absoluta):**

1. **Pantallas separadas**: la pantalla "Comprar Coins" no menciona Tickets ni premios. La pantalla "Cómo conseguir Tickets" no menciona Coins ni IAP.
2. **Flujo de entrada a pool premiado**: solo muestra balance de Tickets. Si el usuario no tiene, lo manda a "Cómo ganar Tickets" — **nunca a "Comprar Coins"**.
3. **No conversión**: ni botón, ni link, ni "intercambiar", ni "boost de Tickets con Coins".
4. **Modelos de datos separados**: dos cuentas/saldos distintos en la base de datos. Las transacciones de Coins y Tickets en tablas separadas, sin foreign key entre sí.
5. **App Store description quirúrgica**: dos párrafos separados.
   - Bueno: *"Compra Coins para acceder a ligas privadas premium, badges y boosts. // Gana Tickets gratis con tu check-in diario, viendo videos opcionales o invitando amigos para entrar a sorteos semanales con tarjetas Amazon de regalo."*
   - **Malo (rechazo seguro)**: *"Compra Coins y gana premios."*
6. **TOS**: cláusula explícita de que Coins son non-refundable, non-transferable to real money, no-monetary-value; y que Tickets son no-comprables, no-transferibles, no-monetary-value, expiran con el sorteo, "no purchase necessary".

**Ventajas vs Camino B simple**:
- Mantienes la monetización de Coins que ya está construida.
- Modelo defendible con precedentes vivos de App Store (Mistplay, Lucktastic, PCH).
- Mejor engagement diario (check-in, ads, misiones) → mayor retención.

**Desventajas / riesgos**:
- Requiere refactor de la app: pantallas separadas, dos saldos, lógica anti-conversión, integración de rewarded ads SDK.
- App Review puede pedir documentación de la "wall" — prepara screenshots y código.
- Si el ratio Tickets:Coins se ve "shadow IAP" (Tickets artificialmente escasos), Apple puede rechazar.
- Mismo costo regulatorio mexicano que Camino B (permiso DGJS, retención ISR, CFDI).
- **Earn rate honesto** crítico: si solo se pueden ganar tickets viendo 100 ads/día para tener probabilidad razonable, Apple puede argumentar real money gaming disfrazado.

### Camino C — "Patrocinador externo" (modelo ESPN+Miller Lite)

**Qué haces**: Buscas marca tercera (banco, marca de consumo, casa de autos como Barush) que paga los premios y aparece como sponsor. Futpools es la plataforma; ellos son el sponsor del concurso.

- **Ventajas**: Mejores unit economics. La marca asume parte del costo regulatorio (puede ser co-organizador del permiso). Posicionamiento premium.
- **Desventajas**: Requiere business development. Negociar con sponsors toma tiempo. Misma carga regulatoria base que Camino B.
- **Riesgo**: Bajo-medio (igual que B), con beneficio económico mayor.

### Camino D — Real money gaming (NO RECOMENDADO sin licencia)

**Qué haces**: Cobras entry fee con premio del pool. Esto es "juego con apuestas".

- **Apple**: cae en 5.3.4 → app gratis, geo-restringida MX, no IAP para depósitos, requiere licencia SEGOB.
- **México**: licencia plena de juegos con apuestas, capital social, fianza. Trámite de meses/años. **No viable** para emprendedor pequeño.
- **Riesgo**: Alto. Operar sin licencia → sanciones LFJS, riesgo penal CPF 257, bloqueo IFT.

---

## 5. Recomendación

**Camino B+ (doble moneda Coins+Tickets, sweepstakes promocional patrocinado por Futpools), opcionalmente migrando a C cuando consigas sponsors de marca.**

Razones:
- Aprovecha la economía de Coins ya existente (no la tiras a la basura).
- Tickets earnable con AMOE robusto (daily check-in) sale de Apple 5.3.4 y entra como sweepstakes 5.3.1–5.3.2.
- Es defendible legalmente y replicable cada temporada.
- Te diferencia de Quiniela Pro y EasyFutbol (que NO entregan premios formales) y de Barush Sports (que opera sin formalidad).
- El costo regulatorio (permiso de sorteo promocional + 3% aprovechamiento + retención ISR + CFDI) es manejable para premios chicos como tarjetas Amazon de $250 MXN.
- Precedentes vivos en App Store (Mistplay, Lucktastic, PCH Sweepstakes, Solitaire Cube/Skillz) demuestran que el modelo se aprueba.

**Antes de implementar nada en código**:

1. **Consulta legal con abogado mexicano especialista en juegos y sorteos** — no fiscalista general, no abogado corporativo. Despachos en CDMX/Monterrey con práctica de gaming/regulatorio. Pide opinión escrita sobre tu modelo. Costo: $5,000–$15,000 MXN.
2. **Verifica autoridad y portal vigente en 2026** para trámite de permiso (gob.mx/segob/juegos-y-sorteos).
3. **Define entidad legal organizadora** (persona moral mexicana ideal, con RFC y domicilio fiscal).
4. **Diseña bases del concurso** con todos los elementos del 2.4 antes de tocar código.

---

## 6. Implicaciones para el código de la iOS app (cuando decidas implementar Camino B+)

Estos son los archivos/áreas que se tocarían en `futpoolsapp/` cuando avances. **Bloque crítico: la wall Coins ↔ Tickets debe quedar en código, no solo en UI.**

### Modelo de datos
- Tabla/colección `coins_balance` (entero, transacciones IAP referenciadas a `originalTransactionId` de StoreKit 2).
- Tabla/colección `tickets_balance` (entero, ledger de transacciones earnable con `source` enum: `daily_checkin`, `rewarded_ad`, `referral`, `mission`, `daily_wheel`, etc.).
- **Sin foreign key entre las dos tablas.** Cero código que mute ambas en una misma transacción.
- Tabla `pool_entries` debe tener columna `entry_method` enum (`tickets_only` para premiados, `coins_only` para premium privados, `free` para sociales). **Si `entry_method == tickets_only`, la entrada SOLO acepta tickets.**

### UI / SwiftUI
- **Pantalla "Cómo obtener Tickets"** — lista de mecanismos (check-in, ads, referrals, misiones), cap diario visible, contador "te faltan X minutos para tu próximo check-in".
- **Daily check-in widget** — un solo tap, fricción mínima, animación de recompensa. Crítico que esté disponible TODOS los días sin condiciones.
- **Rewarded ads SDK** — Google AdMob / AppLovin / IronSource. Cap diario hardcoded (3–5/día sugerido). Texto "Mira un anuncio para ganar 1 ticket extra (opcional)".
- **Pantalla "Bases del Concurso / Reglas Oficiales"** — nueva vista SwiftUI accesible desde el detalle de cada pool premiado y desde Settings. Texto **embebido en el bundle** (no remoto, para cumplir 5.3.2).
- **Disclaimer "Apple no es patrocinador"** — visible en la pantalla de Bases y en el flow de inscripción al pool premiado.
- **Pantalla "Comprar Coins"** — sin mención alguna de Tickets, premios, o sorteos. Solo features/cosméticos.
- **Pantalla "Pools premiados"** — solo muestra balance de Tickets. Si saldo insuficiente, CTA va a "Cómo obtener Tickets" — **NO a "Comprar Coins"**.
- **Verificación de edad 18+** — onboarding o gate al inscribirse a pool premiado.
- **Verificación de residencia MX** — declarativo + IP geo-check (reforzado).
- **Flow de notificación al ganador + captura de datos fiscales** (RFC, CURP, domicilio) — necesario para emitir CFDI de retenciones.

### Tests / lints automáticos
- Test que verifica que **ningún** flow de UI puede llevar de la pantalla de pools premiados a la pantalla de comprar Coins.
- Test que verifica que la API de "entrar a pool premiado" rechaza payloads con `coins_amount > 0`.
- Lint o code review que prohíbe importar el módulo de Coins desde el módulo de Tickets y viceversa.

### Localización
- ES-MX del nuevo contenido (consistente con el feat de localización del commit 3f761ee).
- Bases del concurso en español, con copy revisado por abogado.

### App Store Connect
- **Categoría**: Sports primaria (alineado con Skillz/WorldWinner) o Entertainment secundaria (alineado con Mistplay/PCH). **NO Games** (dispara 4.5.4 lootboxes y vigilancia 5.3 más estricta).
- **Edad recomendada**: 17+ mínimo.
- **Geo-restricción**: solo México disponible en `App Availability`.
- **Description quirúrgica** (ES-MX y EN-US):
  - Bueno: *"Compra Coins para acceder a ligas privadas premium, badges y boosts cosméticos. // Gana Tickets gratis con tu check-in diario, viendo videos opcionales o invitando amigos para entrar a sorteos semanales con tarjetas Amazon de regalo. No se requiere compra para entrar al sorteo."*
  - Malo: cualquier frase que cruce las dos monedas.
- **App Review Notes** detalladas:
  - Explicar el modelo de sweepstakes (no real money gaming).
  - Citar precedentes: Mistplay (ID 6739352969), Lucktastic, PCH Sweepstakes.
  - Mencionar que las Bases del Concurso están embebidas en la app (path al feature).
  - Mencionar permiso SEGOB de sorteo con fines promocionales (adjuntar PDF).
  - Confirmar que Coins (IAP) y Tickets (earnable) son economías separadas en código, UI y description.

Estos cambios merecen un **plan de implementación separado** una vez decidas seguir el Camino B+ y tengas:
- Opinión legal mexicana en mano
- Permiso DGJS tramitado o en proceso
- Bases del concurso redactadas y revisadas por abogado
- RFC y proceso fiscal listo
- SDK de rewarded ads escogido

---

## 7. Estructura del sistema de Tickets (cómo los usuarios ganan Tickets)

Esta sección define el catálogo completo de mecanismos por los que un usuario puede ganar Tickets, adaptado a la arquitectura actual de Futpools (SwiftUI puro, custom Node.js backend en `APIClient.swift`, StoreKit 2 para Coins, email/password auth, sin Firebase, sin age gate hoy). Las dos columnas de "Recompensa" y "Cap diario" son sugerencias de calibración inicial — afínalas con datos reales después de lanzar.

### 7.1 Catálogo unificado de mecanismos

| # | Mecanismo | Recompensa | Cap | Cooldown | Riesgo Apple | Prioridad MVP |
|---|---|---|---|---|---|---|
| 1 | **Daily check-in** (AMOE crítico) | 1 Ticket / día | 1/día | 24h | Bajo | **P0** |
| 2 | **Streak bonus** (7 días seguidos) | +5 Tickets bonus en día 7 | 1 streak/semana | reset al fallar día | Bajo | P0 |
| 3 | **Rewarded ads** | 1 Ticket / 3 ads | 5 ads/día (≈1.6 Tickets) | sin cooldown intra-cap | Medio si es exclusivo | P0 |
| 4 | **Referral exitoso** (amigo se registra Y participa en 1 pool premiado) | 10 Tickets al referidor + 5 Tickets de bienvenida al referido | sin cap | one-time por referido | Bajo | P0 |
| 5 | **Welcome bonus** (registro nuevo) | 3 Tickets | 1/cuenta | one-time | Bajo | P0 |
| 6 | **Misiones diarias** ("haz picks en 3 quinielas gratis", "comenta en 1 pool", "comparte un pool") | 1 Ticket / misión | 3 misiones/día | reset 00:00 MX | Bajo | P1 |
| 7 | **Misiones semanales** ("entra a 5 pools gratis", "completa el pool semanal") | 5 Tickets | 1/semana | reset domingo | Bajo | P1 |
| 8 | **Rueda de la fortuna gratuita** | 0–3 Tickets random + premios cosméticos | 1 spin/día gratis | 24h | Bajo (si NO hay spins comprables) | P1 |
| 9 | **Trivia diaria de fútbol** (3 preguntas) | 1 Ticket si aciertas las 3 | 1/día | 24h | Bajo | P2 |
| 10 | **Compartir pool en RRSS** | 1 Ticket | 1/día | 24h | Bajo | P2 |
| 11 | **Activar notificaciones push** | 5 Tickets | one-time | — | Bajo | P1 (requiere push primero) |
| 12 | **Vincular cuenta social** (Apple/Google sign-in) | 5 Tickets | one-time | — | Bajo | P2 |
| 13 | **Cumpleaños** | 10 Tickets | 1/año | 365d | Bajo | P2 |
| 14 | **Achievements milestones** ("primer pool ganado", "10 picks correctos seguidos") | 3–10 Tickets variable | sin cap (one-shot por achievement) | — | Bajo | P1 |
| 15 | **Eventos especiales temporada** (Mundial, Final Liga MX, Champions Final) | bonus duplicado, doble check-in, etc. | event-scoped | event-scoped | Bajo | P2 |
| ❌ | Suscripción IAP que dé Tickets | — | — | — | **CRÍTICO 5.3.4** | NUNCA |
| ❌ | Convertir Coins → Tickets | — | — | — | **CRÍTICO 5.3.4** | NUNCA |
| ❌ | Bundle "compra Coins + recibe Tickets" | — | — | — | **CRÍTICO 5.3.4** | NUNCA |
| ❌ | Reviews en App Store | — | — | — | **PROHIBIDO 3.2.2** | NUNCA |
| ⚠️ | Offerwall externo (Tapjoy "instala juego = Tickets") | — | — | — | Medio-alto | EVITAR |

**Earning ceiling diario realista** (sumando P0+P1 sin eventos especiales):
- Check-in: 1
- Rewarded ads (cap 5): ~1.6
- Misiones diarias (3 × 1): 3
- Rueda gratis: ~1.5 promedio
- Trivia: ~1
- Compartir: 1
- **Total típico: ~9 Tickets/día**, con peaks por streak/referral/eventos

Con un sorteo Amazon $250 MXN semanal, un usuario activo casual obtiene ~63 tickets/semana → si cada entrada al sorteo cuesta 5 Tickets, puede entrar 12 veces. Un usuario que solo hace check-in (AMOE puro) obtiene 7 Tickets/semana → 1 entrada. **El AMOE permite participar realmente sin hacer nada más, lo cual es la prueba legal clave**.

### 7.2 Diseño detallado por mecanismo

#### 7.2.1 Daily check-in (P0 — AMOE crítico)
- **UX**: Card en HomeView con CTA "RECLAMAR DIARIO" + contador "Próximo: 14:23:01". Animación de coin-rain al reclamar.
- **Backend**: `POST /users/me/rewards/checkin` → body vacío.
  - Server valida: `now() - last_checkin_at >= 24h`. Si no, 429.
  - Suma 1 Ticket, actualiza `last_checkin_at`, devuelve `{ tickets_balance, streak_days }`.
  - Si `streak_days % 7 == 0`, bonus +5.
- **Persistencia**: nuevo campo en `users` table: `last_checkin_at: timestamptz`, `streak_days: int`.
- **SwiftUI**: nueva vista `Features/Rewards/DailyCheckinCard.swift`. Embed en HomeView header.
- **Anti-fraude**: validación en server (no trust client clock). Reset por TZ del servidor (México UTC-6).

#### 7.2.2 Rewarded ads (P0)
- **SDK sugerido**: Google Mobile Ads (AdMob) — soporte mejor en LATAM, fill rate alto en MX. Alternativa: AppLovin MAX.
- **UX**: Botón "VER VIDEO POR +1 TICKET (3/5 hoy)" en pantalla de Rewards. Al completar el video, animación + balance update.
- **Flow técnico**:
  1. Cliente inicia ad: `RewardedAd.load()` → muestra al completar.
  2. Apple/Google emite **SSV (Server-Side Verification)** callback al backend con un JWT firmado.
  3. Backend valida JWT, comprueba `user_id` y `transaction_id` único, suma 1 Ticket.
  4. Cliente hace `POST /users/me/rewards/ad-watched` como confirmación, recibe nuevo balance.
- **Anti-fraude crítico**:
  - **Solo confiar en SSV callback de AdMob/AppLovin** (no en evento del cliente).
  - Cap de 5 ads/24h por user_id en backend.
  - Detectar device farms: rate limit por IP + `device_id` (DeviceCheck API o IDFV).
  - Apple App Attest para verificar que la app no está modificada.
- **Persistencia**: tabla `rewarded_ad_views(id, user_id, network, ssv_token, watched_at, ticket_awarded)`.
- **SwiftUI**: nueva vista `Features/Rewards/RewardedAdButton.swift`. SDK config en `futpoolsappApp.swift`.
- **App Store Review note**: declarar que ads son OPCIONALES y que daily check-in da Tickets sin ver ads (AMOE).

#### 7.2.3 Referral program (P0)
- **UX**: ProfileView → "INVITA AMIGOS, GANA TICKETS". Genera link único `https://futpools.com/r/<refCode>` o deep link `futpools://r/<refCode>`. Botón share usa `ShareLink` SwiftUI.
- **Flow**:
  1. Usuario A genera código (auto-generado al registro: ej. `RIBARRA42`).
  2. Comparte link.
  3. Usuario B se registra usando `referrer_code` (capturado por deep link → guardado en RegisterView).
  4. Backend marca `users.referrer_id = A.id` en registro.
  5. Cuando B completa su primer pool premiado (entrada con Tickets), backend dispara reward a A: +10 Tickets, y a B: +5 Tickets de bienvenida.
- **Anti-fraude**:
  - 1 referidor por usuario (no se puede cambiar después).
  - Self-referral detection: bloqueo por device_id, IP, IDFV.
  - Reward solo después de que B participe en pool premiado, no solo al registrarse (evita farms con cuentas zombi).
  - Cap absoluto: 50 referrals/usuario por temporada (configurable).
- **Persistencia**: extender `users` con `referrer_id`, `referral_code`. Nueva tabla `referral_rewards(id, referrer_id, referee_id, awarded_at, status)`.
- **SwiftUI**: vista `Features/Rewards/ReferralView.swift`. RegisterView debe leer query param/deep link al abrir.

#### 7.2.4 Misiones (P1)
- **UX**: Pantalla "Misiones" con sección "Hoy" (3 tareas), "Esta semana" (1 grande). Cada misión tiene progress bar.
- **Tipos de misiones**:
  - "Haz picks en 3 pools gratis" — basado en eventos `quiniela_entry_created` con `entryCostCoins == 0`
  - "Comparte 1 pool" — share event tracked
  - "Entra a 5 pools esta semana" — weekly
  - "Completa una racha de 5 picks correctos" — match results
- **Backend**: tabla `missions(id, user_id, mission_template_id, progress, target, completed_at, ticket_reward)`. Cron job genera misiones diarias 00:00 MX.
- **SwiftUI**: vista `Features/Rewards/MissionsView.swift`.

#### 7.2.5 Welcome bonus (P0)
- Reemplaza el `signupBonus` actual (Coins) o lo complementa: backend en `POST /auth/register` retorna `{ signupCoinsBonus, signupTicketsBonus: 3 }`.
- **SignupBonusCelebrationSheet** (ya existe) se actualiza para mostrar ambos.

#### 7.2.6 Streak bonus (P0)
- Lógica integrada con check-in. Día 1: +1, Día 2: +1, ..., Día 7: +1+5 (total 6). Día 8: +1+5+0 (reset visual del badge "Streak Master").
- UI: contador visible en DailyCheckinCard "🔥 Día 4/7".

#### 7.2.7 Rueda de la fortuna (P1)
- **UX**: Rueda con 8 segmentos: 4 segmentos de Tickets (0, 1, 1, 3), 4 de cosméticos (badge, theme unlock, etc.). Animación de spin + sonido.
- **Crítico**: 1 spin gratis/día. **NO permitir spins comprables con Coins ni con dinero real** (esto sería gacha + lottery → Apple 4.5.4 + 5.3.4 + LFJS).
- **Backend**: `POST /users/me/rewards/wheel-spin` retorna outcome aleatorio server-side (no client RNG). Probabilidades publicadas en TOS (cumplimiento estilo regulación china de gacha — buena práctica defensiva).

#### 7.2.8 Trivia diaria (P2)
- 3 preguntas de fútbol (Liga MX, Champions, etc.). Si aciertas las 3, +1 Ticket. Si no, 0. Una sola intentona/día.
- **Backend**: `GET /trivia/daily` (preguntas) + `POST /trivia/daily/submit` (respuestas).
- Nueva tabla `trivia_daily(id, date, questions_json)` + `trivia_attempts(user_id, date, correct_count, ticket_awarded)`.

#### 7.2.9 Compartir pool en RRSS (P2)
- ShareLink trigger un evento al backend `POST /users/me/rewards/share` con `pool_id`.
- Cap 1/día. Validación: solo cuenta una vez por pool, y solo si el pool tiene `visibility == public`.

#### 7.2.10 Activar notificaciones push (P1)
- **Pre-requisito**: integrar push notifications (no existe hoy). APNs + posiblemente OneSignal o backend custom.
- One-time bonus al primer accept del prompt: +5 Tickets.
- **Anti-abuse**: si el usuario revoca y vuelve a aceptar, NO repite el bonus.

#### 7.2.11 Vincular cuenta social (P2)
- Agregar Apple Sign In y Google Sign In como opciones secundarias (mantener email/password como primaria).
- Bonus one-time +5 Tickets al vincular.
- Beneficio adicional: reduce fraude (Apple Sign In con Hide My Email + Apple ID es más difícil de farmear que email/password).

#### 7.2.12 Cumpleaños (P2)
- Requiere capturar DOB en RegisterView (que hoy NO se captura). **Aprovechar**: agregar age gate 18+ y DOB en el mismo refactor (necesario para Camino B+ regardless).
- Backend: cron job diario revisa `users.dob == today` → +10 Tickets, push notification si push está integrado.

#### 7.2.13 Achievements milestones (P1)
- Ya existe `AchievementCatalog` (referenciado en `Features/Profile/`). Extender cada achievement con `ticket_reward: Int`.
- Backend: al desbloquear achievement, suma Tickets atómicamente.

#### 7.2.14 Eventos especiales (P2)
- Mundial 2026 (junio-julio 2026) — flag temporal `events_active.world_cup_2026 = true`.
- Doble check-in, rueda con segmentos especiales, misiones temáticas.
- Backend: tabla `events(id, name, start, end, multipliers_json)` + middleware que aplica multipliers en endpoints de earning.

### 7.3 Modelo de datos — extensiones al backend Node.js

```
-- usuarios: extensiones
ALTER TABLE users ADD COLUMN tickets_balance INT DEFAULT 0;
ALTER TABLE users ADD COLUMN last_checkin_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN streak_days INT DEFAULT 0;
ALTER TABLE users ADD COLUMN referral_code VARCHAR(12) UNIQUE;
ALTER TABLE users ADD COLUMN referrer_id BIGINT REFERENCES users(id);
ALTER TABLE users ADD COLUMN dob DATE;  -- para age gate + cumpleaños
ALTER TABLE users ADD COLUMN country_code CHAR(2);  -- para geo-restricción

-- ledger inmutable de transacciones de tickets (nunca se sobrescribe el balance)
CREATE TABLE ticket_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  delta INT NOT NULL,                      -- +N (earn) o -N (spend)
  source VARCHAR(50) NOT NULL,             -- 'daily_checkin', 'rewarded_ad', 'referral_reward', 'mission', 'pool_entry', etc.
  source_ref VARCHAR(100),                 -- pool_id, ad_ssv_token, mission_id, referee_id, etc.
  balance_after INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, source_ref)              -- idempotencia: no dobles cobros
);

CREATE TABLE rewarded_ad_views (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  network VARCHAR(20) NOT NULL,            -- 'admob' | 'applovin'
  ssv_token VARCHAR(500) NOT NULL UNIQUE,  -- de Apple/Google SSV
  device_id VARCHAR(100),                  -- IDFV
  ip_addr INET,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ticket_awarded BOOLEAN NOT NULL
);

CREATE TABLE missions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  template_id VARCHAR(50) NOT NULL,        -- 'daily_picks_3', 'weekly_5_pools', etc.
  progress INT NOT NULL DEFAULT 0,
  target INT NOT NULL,
  ticket_reward INT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ
);

CREATE TABLE referral_rewards (
  id BIGSERIAL PRIMARY KEY,
  referrer_id BIGINT NOT NULL,
  referee_id BIGINT NOT NULL UNIQUE,       -- cada usuario solo puede ser referido 1 vez
  triggered_pool_id BIGINT,                -- el pool que disparó la recompensa
  awarded_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL              -- 'pending' | 'awarded' | 'rejected_fraud'
);

CREATE TABLE pool_entries_premium (
  id BIGSERIAL PRIMARY KEY,
  pool_id BIGINT NOT NULL,                 -- pool con premio real
  user_id BIGINT NOT NULL,
  tickets_spent INT NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pool_id, user_id)                -- 1 entrada por usuario por pool
);
```

**Crítico — separación absoluta**: la tabla `pool_entries_premium` SOLO referencia Tickets. La tabla `quiniela_entries` actual (que consume `entryCostCoins`) sigue separada. Cero foreign key entre `ticket_transactions` y la economía de Coins. Cero código que mute ambos balances en una transacción atómica.

### 7.4 Endpoints REST nuevos

```
# Earning
POST   /users/me/rewards/checkin              # daily check-in
POST   /users/me/rewards/ad-watched           # confirma SSV de rewarded ad
POST   /admob/ssv-callback                    # webhook de AdMob (público pero firmado)
POST   /applovin/ssv-callback                 # webhook de AppLovin (público pero firmado)
POST   /users/me/rewards/wheel-spin           # rueda diaria
POST   /users/me/rewards/share                # share event
POST   /users/me/rewards/notifications-enabled # push opt-in
POST   /users/me/rewards/social-link          # vinculó Apple/Google
GET    /users/me/missions                     # misiones activas
POST   /users/me/missions/:id/claim           # reclamar misión completada
GET    /trivia/daily                          # preguntas del día
POST   /trivia/daily/submit                   # enviar respuestas

# Referrals
GET    /users/me/referral                     # mi código + stats
POST   /auth/register                         # extender body para aceptar referrer_code

# Tickets balance + ledger
GET    /users/me/tickets                      # balance + ledger paginado
GET    /users/me/tickets/transactions         # ledger detallado (para "Mi historial")

# Pools premiados (sweepstakes)
GET    /pools/premium                         # lista de sorteos activos con premio real
POST   /pools/premium/:id/enter               # gasta Tickets para entrar (NUNCA Coins)
GET    /pools/premium/:id/rules               # bases del concurso (también embedded en bundle)
```

**App Review note clave**: ningún endpoint de earning recibe `coin_amount`. Ninguno acepta pago. El único endpoint que acepta dinero real (`POST /users/me/balance/recharge` con StoreKit JWS) **no tiene rama que sume Tickets**.

### 7.5 Pantallas SwiftUI nuevas (paths exactos)

```
futpoolsapp/
├── Features/
│   ├── Rewards/                       [NUEVO MÓDULO]
│   │   ├── RewardsHubView.swift              # Hub central con todos los earn methods
│   │   ├── RewardsHubViewModel.swift
│   │   ├── DailyCheckinCard.swift            # embed en HomeView
│   │   ├── RewardedAdButton.swift            # botón con cap visible
│   │   ├── RewardedAdService.swift           # wrapper de AdMob SDK
│   │   ├── ReferralView.swift
│   │   ├── ReferralViewModel.swift
│   │   ├── MissionsView.swift
│   │   ├── MissionsViewModel.swift
│   │   ├── DailyWheelView.swift
│   │   ├── TriviaView.swift
│   │   └── TicketHistoryView.swift           # ledger del usuario
│   ├── Pools/                          [NUEVO o sub-módulo de Quinielas]
│   │   ├── PremiumPoolsListView.swift        # lista de sorteos con premio real
│   │   ├── PremiumPoolDetailView.swift       # detalle + bases + botón entrar con Tickets
│   │   └── ContestRulesView.swift            # bases oficiales del concurso (embedded)
│   └── Auth/
│       └── RegisterView.swift                # MODIFICAR: agregar DOB + country + referrer code
├── Models/
│   ├── Tickets.swift                         [NUEVO]
│   ├── TicketTransaction.swift               [NUEVO]
│   ├── Mission.swift                         [NUEVO]
│   ├── PremiumPool.swift                     [NUEVO]
│   └── User.swift                            # MODIFICAR: agregar ticketsBalance, dob, country, referralCode
├── Services/
│   ├── RewardsService.swift                  [NUEVO] llamadas a /users/me/rewards/*
│   ├── TicketsService.swift                  [NUEVO] balance + transacciones
│   └── APIClient.swift                        # extender (no romper)
└── Core/Components/Arena/
    ├── TicketBadge.swift                     [NUEVO] análogo a coin badge, color distinto
    └── DualBalancePill.swift                 [NUEVO] muestra Coins + Tickets separados
```

### 7.6 Integración con la UI existente (impacto en pantallas actuales)

| Pantalla actual | Cambio |
|---|---|
| **HomeView** | Agregar `DailyCheckinCard` debajo del hero. Nueva sección "Pools Premiados (gana premios reales)" usando `PremiumPoolsListView`. Header dual balance (Coins + Tickets, badges separados). |
| **MainTabView** | Considerar tab nueva "REWARDS" (5ª tab) con `RewardsHubView`. Alternativa: integrar en ProfileView para no recargar el tab bar. **Recomendación: ProfileView** (mantiene la app a 4 tabs). |
| **ProfileView** | Sección "Mis Tickets" con balance + acceso a `RewardsHubView`. Sección "Mi código de invitación". |
| **RechargeView (Shop)** | **NO TOCAR para Tickets.** Solo Coins. Agregar disclaimer al final: "Las Coins son para features premium. Para entrar a sorteos con premios reales, gana Tickets gratis en Rewards." |
| **MakeQuinielaView** | Si el pool es premium (premio real): bloquear entrada con Coins, redirigir a flow `PremiumPoolDetailView`. |
| **QuinielaDetailView** | Mostrar badge "PREMIO REAL" en pools premium. Banner con bases del concurso ("Ver bases" → `ContestRulesView`). |
| **RegisterView** | Agregar campos: DOB (date picker, requiere 18+), country picker (default MX), opcional referrer_code (auto-llenado por deep link). |
| **SignupBonusCelebrationSheet** | Mostrar ambos: "+50 Coins · +3 Tickets". |
| **SettingsView** | Sección "Términos del concurso" → `ContestRulesView`. Disclaimer "Apple no es patrocinador". |

### 7.7 Anti-fraude (crítico, porque Tickets = valor real)

- **Server-side enforcement** de TODOS los caps. Cliente nunca decide cuándo otorgar Tickets.
- **Idempotency keys** en cada endpoint de earning (ej. para SSV: `ssv_token` UNIQUE en DB).
- **Apple App Attest** para verificar integridad de la app en cada llamada de earning.
- **DeviceCheck** o IDFV para detectar device farms (mismo `device_id` con N cuentas → ban).
- **Rate limit por IP**: máximo 10 cuentas registrándose desde la misma IP en 24h.
- **Self-referral detection**: device fingerprint (IDFV + IP + email domain) — si referrer y referee comparten 2+ → ban referral.
- **Sybil attack defense en sorteos**: si un usuario tiene >50 entries en un sorteo (ej. todas con cuentas referidas), flag manual review antes de entregar premio.
- **Ledger inmutable**: `ticket_transactions` nunca UPDATE/DELETE; solo INSERT. Auditable.
- **Panel admin**: AdminDashboardView ya existe — extender con vista "Sospechosos" mostrando users con high-velocity earning, multi-account device patterns, etc.

### 7.8 Calibración económica (premio Amazon $250 MXN ≈ $14 USD)

Asume sorteo semanal con 100 entradas totales (entrada = 5 Tickets):

| Costo de Tickets para Futpools | Estimación |
|---|---|
| 100 entradas × 5 Tickets = 500 Tickets entregados/semana | costo de oportunidad |
| eCPM rewarded ads MX: $5–15 USD | 1 ad ≈ $0.005–0.015 USD = $0.10–0.30 MXN |
| Si 30% de entries vienen de ads (150 Tickets / 3 ads/Ticket = 450 ads) | revenue ads: $4.50–13.50 USD |
| Ingreso publicitario semanal | ≈ $4.50–13.50 USD |
| Costo del premio | $14 USD |
| **Subsidio neto** | **~$0.50 a $9.50 USD/semana por sorteo** |

Compensación: Coins IAP es el revenue principal. El sistema de Tickets es **engagement engine + lead generator** para usuarios que eventualmente compran Coins.

**Reglas de negocio defensivas**:
- Tickets caducan al cierre del sorteo correspondiente (no acumulables indefinidamente, evita whales).
- Cap absoluto de Tickets en wallet activa: 200 (excedente se quema o convierte en cosmético).
- Cuando un usuario gana, sus Tickets restantes pasan a 0 — premio real es el reward, no más Tickets.
- Sorteos **siempre tienen mínimo de participantes** (ej. 20). Si no se alcanza, el premio rolling-over a la siguiente semana (declarado en bases).

### 7.9 Roadmap de implementación sugerido

| Fase | Duración | Entregables |
|---|---|---|
| **Fase 0 — Legal** (paralelo) | 2–6 semanas | Opinión legal MX, permiso DGJS sorteo promocional, bases del concurso redactadas, RFC entidad legal |
| **Fase 1 — Infra Tickets** | 1–2 semanas | Schema DB, endpoints `/users/me/tickets/*`, `Models/Tickets.swift`, ledger funcional, balance dual visible |
| **Fase 2 — AMOE + Welcome** | 1 semana | Daily check-in, streak, welcome bonus +3 Tickets, `DailyCheckinCard` en HomeView |
| **Fase 3 — Rewarded ads** | 2 semanas | AdMob SDK, SSV backend, `RewardedAdButton`, anti-fraude (App Attest, rate limits) |
| **Fase 4 — Referrals** | 1–2 semanas | Sistema completo de referrals, deep links, anti-self-referral |
| **Fase 5 — Misiones** | 1–2 semanas | Engine de misiones, cron jobs, MissionsView |
| **Fase 6 — Pools premiados** | 2 semanas | `PremiumPoolsListView`, `ContestRulesView` embedded, flow de entrada con Tickets, KYC ganador, CFDI |
| **Fase 7 — Age gate + país** | 1 semana | Refactor RegisterView con DOB 18+ y country, geo-restricción Apple App Availability solo MX |
| **Fase 8 — App Review prep** | 1 semana | App Store Connect description quirúrgica, App Review Notes detalladas con precedentes Mistplay/Skillz, screenshots de bases embebidas |
| **Fase 9 — Beta TestFlight** | 2 semanas | Validación end-to-end con permiso SEGOB activo, primer sorteo real con grupo cerrado |
| **Fase 10 — Lanzamiento** | — | Submit to App Store con review notes completas |
| **Fase 11 (opcional) — Misc** | — | Rueda, trivia, achievements bonus, eventos especiales (Mundial 2026 junio) |

**Total estimado**: 14–20 semanas de desarrollo + 2–6 semanas de legal en paralelo.

---

## 8. Verificación / próximos pasos accionables

Este documento no requiere "verificación" en sentido técnico (no es un cambio de código). Pero los siguientes pasos sí son accionables y verificables:

1. ☐ Agendar consulta con abogado mexicano especialista en gaming (1–2 semanas).
2. ☐ Solicitar opinión escrita sobre el modelo Camino B aplicado a Futpools (2–4 semanas).
3. ☐ Verificar URL y requisitos vigentes 2026 en gob.mx para "Permiso de Sorteo con Fines Promocionales".
4. ☐ Preparar borrador de Bases del Concurso (puede hacerlo el abogado).
5. ☐ Definir entidad legal organizadora y registrar para fines fiscales si no existe.
6. ☐ Una vez tengas opinión legal y entidad lista, **abrir un nuevo plan de implementación** para los cambios en `futpoolsapp/`.

---

## Referencias clave

- Apple: https://developer.apple.com/app-store/review/guidelines/ (sec. 5.3)
- LFJS México: https://www.diputados.gob.mx/LeyesBiblio/pdf/109.pdf
- DGJS SEGOB: http://www.juegosysorteos.gob.mx/ (verificar vigencia 2026)
- Quiniela Pro TOS: https://www.quinielapro.com/terms
- Barush Sports (modelo MX patrocinado): https://www.barushseminuevos.com/quiniela-barush-sports-liga-mx-premios-amazon-jerseys/
- ESPN Miller Lite Sweepstakes Rules (modelo formal US): https://www.espn.com/fantasy/football/story/_/id/45908449/official-rules
- CBS Sports Pick'em Rules (skill-based gratuito US): https://www.cbssports.com/fantasy/football/games/pickem/rules
- LISR arts. 137–139 (premios), LFPC arts. 32, 46, 47 (Profeco), CPF art. 257 (penal)

### Precedentes vivos del modelo doble moneda + premios reales
- Mistplay (App Store ID 6739352969, Entertainment, 18+): https://apps.apple.com/us/app/mistplay-play-games-earn-cash/id6739352969
- Solitaire Cube / Skillz (App Store ID 1114214294, Card, 17+, depósitos NO Apple IAP): https://apps.apple.com/us/app/solitaire-cube-real-cash-game/id1114214294
- Skillz iOS Store Rejections Guide: https://docs.skillz.com/docs/ios-store-rejections/
- Lexology — Mobile App Sweepstakes and the Law (doctrina AMOE): https://www.lexology.com/library/detail.aspx?g=dccc3735-cbdb-4e3a-aecd-41f72ebeebb2

### Playbook de UX dual currency (referencia, no premios reales)
- WebNovel (Coins IAP + Bonus earnable, Books): https://www.webnovel.com/
- ReelShort (Coins + Bonus, Entertainment, micro-drama): https://www.reelshort.com/

---

> ⚠️ **Disclaimer**: Este documento es una investigación de hechos y opciones, NO constituye asesoría legal. La regulación mexicana de juegos y sorteos es un campo especializado y la autoridad ha mostrado criterios cambiantes. Antes de operar comercialmente con premios reales, valida con abogado mexicano especialista.
