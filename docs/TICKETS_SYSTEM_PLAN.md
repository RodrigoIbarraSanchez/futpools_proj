# Plan: Sistema de Tickets para Pools Premiados (Premios Reales)

> **Estado**: Investigación + diseño completo. Pendiente de aprobación legal MX y permiso SEGOB antes de implementar.
> **Última actualización**: 2026-04-29
> **Origen**: Investigación detallada sobre App Store Guidelines 5.3, Ley Federal de Juegos y Sorteos (México), y precedentes vivos (Mistplay, Lucktastic, PCH Sweepstakes, Skillz, WebNovel/ReelShort).

---

## Resumen ejecutivo (para retomar rápido)

**Pregunta original**: ¿Puedo, como dueño de la iOS app Futpools, ofrecer premios reales (tarjetas Amazon $250 MXN, mercancía) a los ganadores de las quinielas?

**Respuesta corta**: Sí, **pero el modelo actual NO es viable**. Hoy Futpools tiene una sola moneda (Coins comprables vía IAP) y eso choca de frente con Apple Guideline 5.3.3 ("no usar IAP para currency en conjunción con real money gaming") y con la LFJS mexicana (compra de Coins = contraprestación → sorteo regulado).

**Solución**: Modelo de **doble moneda** con "wall" absoluta entre las dos:

| | **Coins** (existente) | **Tickets** (nuevo) |
|---|---|---|
| Cómo se obtienen | IAP de Apple | Solo earnable (check-in, ads, referrals, misiones) |
| Para qué sirven | Features cosméticos, ligas privadas premium, badges | **Única** entrada a quinielas con premio real |
| Conversión entre sí | **PROHIBIDA en código y UI** | **PROHIBIDA en código y UI** |

Con esto, el modelo cae en **Apple 5.3.1–5.3.2 (sweepstakes)** en vez de 5.3.4 (real money gaming). Probabilidad estimada de aprobación: **70–85%** condicionado a la wall absoluta.

**Precedentes vivos**: Mistplay (App Store ID 6739352969), Solitaire Cube/Skillz (ID 1114214294), Lucktastic, PCH Sweepstakes — todos con doble economía, premios reales, aprobados.

**Componente más crítico**: el **daily check-in** es el AMOE (Alternative Method of Entry) que blinda legalmente el sorteo. Sin AMOE robusto, Apple recategoriza a real money gaming.

---

## Arquitectura actual de Futpools (descubierta)

- **iOS app**: SwiftUI puro, 71 archivos `.swift`, sin UIKit, sin tests.
- **Backend**: Custom Node.js (NO Firebase). REST via `Services/APIClient.swift`.
- **Auth**: Email + password (no Apple Sign In hoy). Token en Keychain.
- **Moneda actual**: Coins (campo `User.balance: Double?`). Compradas vía StoreKit 2 (`Features/Profile/RechargeView.swift`). Productos: `com.futpools.recharge.{50,100,200,500}`.
- **Endpoint actual relevante**: `POST /users/me/balance/recharge` valida JWS de StoreKit y suma Coins.
- **Localización**: EN + ES (`*.lproj/Localizable.strings`, ~642 entries en español).
- **NO existe hoy**: push notifications, age gate, country picker, analytics, ads, Crashlytics.
- **Tabs principales**: POOLS / ENTRIES / SHOP / PROFILE (4 tabs en `MainTabView`).

Archivos clave para tener en mente:
- `futpoolsapp/Models/User.swift` — extender con `ticketsBalance`, `dob`, `countryCode`, `referralCode`
- `futpoolsapp/Features/Auth/RegisterView.swift` — agregar DOB 18+, country, referrer code
- `futpoolsapp/Features/Profile/ProfileView.swift` — sección "Mis Tickets" + acceso a Rewards Hub
- `futpoolsapp/Features/Home/HomeView.swift` — embed `DailyCheckinCard`, sección "Pools Premiados"
- `futpoolsapp/Features/Profile/RechargeView.swift` — NO TOCAR para Tickets, agregar disclaimer

---

## Líneas rojas absolutas (NO romper)

1. ❌ **Convertir Coins → Tickets** en cualquier dirección
2. ❌ **Suscripción IAP** que dé Tickets como reward
3. ❌ **Bundle "compra Coins + recibe Tickets"**
4. ❌ **Description del App Store** que cruce las dos monedas en una frase
5. ❌ **Reviews del App Store** como mecanismo de earning (prohibido por Apple 3.2.2)
6. ⚠️ **Offerwall externo** (Tapjoy "instala juego = Tickets") — evitar cuando lleva a premio real

Si cualquiera de estas se rompe → Apple recategoriza a 5.3.4 (real money gaming) → necesitas licencia SEGOB plena (no viable).

---

## Filosofía del earning — los dos loops independientes que se autoalimentan

El reto económico real: **los premios se pagan con dinero que viene de IAP de Coins, pero los Tickets NO se pueden vender**. Si los Tickets se desconectan totalmente del comportamiento de gasto de Coins, no hay flujo. Si se conectan directamente, Apple recategoriza a 5.3.4 y el proyecto muere.

**Solución**: dos loops desacoplados en código y UI, pero acoplados en *comportamiento del usuario*.

```
┌──────────────────────── LOOP DE COINS (revenue) ────────────────────────┐
│                                                                         │
│   Usuario compra Coins (IAP) ──► Coin sinks (varios) ──► Balance baja  │
│              ▲                                                  │       │
│              └─────────────── recompra ◄─────────────────────────       │
└─────────────────────────────────────────────────────────────────────────┘
                                  ║
                                  ║  (cero conversión directa)
                                  ║  (acoplamiento solo via actividad)
                                  ▼
┌──────────────────────── LOOP DE TICKETS (engagement) ───────────────────┐
│                                                                         │
│   Daily Pick check-in (1/día)  ──┐                                      │
│   Rewarded ads (sin cap)        ─┼──► Tickets en wallet                 │
│              │                                                          │
│              └─────────► Entrada a sorteo semanal premio real (7 Tkts)  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Lo brillante**: el sistema de Tickets es completamente independiente del gasto de Coins. Aún así, el usuario que compra Coins (más quinielas, power-ups, cosmetics) tiende a abrir la app más, hacer más Daily Picks, ver más ads → genera más Tickets como subproducto natural. Apple no ve un puente; legalmente solo hay actividad.

**Regla de oro**: ninguna recompensa de Tickets puede tener como condición *literal* "gastar X Coins" o "comprar Y Coins". Siempre debe ser un evento neutro (predecir, abrir, ver, alcanzar) que el usuario *puede* lograr sin gastar.

---

## Coin sinks — el motor de revenue (decoupled de Tickets)

Para que los premios semanales se autofinancien, los Coins deben tener suficientes lugares para gastarse de forma recurrente. Catálogo propuesto, ordenado por impacto esperado en velocidad de recompra:

### S1 — Sinks core (ya existen, expandir)

| Sink | Mecánica | Notas |
|---|---|---|
| **Entry cost en pools** | Costo por entrada definido por creador (10–500 Coins) | Ya existe. Bumpear catálogo de pools premium del staff (mejores premios cosméticos para ganadores) |
| **Multi-entrada** | Mismo pool, 3 entries con variaciones de picks (3× costo, 3× chances) | Nuevo — alta correlación con jugadores serios |
| **Sponsor prize** | Creador paga el premio en Coins + 10% rake | Ya existe |

### S2 — Power-ups por pool (nuevos, alta velocidad de drenaje)

| Power-up | Costo aprox | Función |
|---|---|---|
| **Pick reveal** | 50 Coins | Ver % del pool que pickeó cada opción en un fixture (información estratégica) |
| **Late edit** | 100 Coins | Editar picks hasta 5 min antes del kickoff de un fixture específico |
| **Insurance** | 200 Coins | Si pierdes la quiniela, recibes 50% de tu entry de vuelta |
| **Double-down** | 100 Coins | Apuesta extra en UN pick para multiplicador 1.5× si aciertas |
| **Streak shield** | 100 Coins | Protege tu daily streak de un día perdido |

### S3 — Cosmetics + status (cero impacto en gameplay)

| Item | Costo aprox | Función |
|---|---|---|
| **Avatar frames** | 50–500 Coins | Marcos visuales en profile + leaderboard |
| **Name colors** | 200 Coins/mes | Color del nombre en rankings |
| **Profile badges** | 100–300 Coins | Logros comprables (separados de achievements gratuitos) |
| **Custom pool skin** | 500 Coins | Skin/logo en una quiniela privada que tú creas |

### S4 — Social tipping

| Acción | Costo |
|---|---|
| **Tip al creador del pool** | 50/100/200 Coins (creador recibe 90%, plataforma 10% rake) |
| **Tip al líder del leaderboard** | 50 Coins (gesto post-partido) |

### S5 — Premium subscription (mensual, opcional)

| Tier | Precio | Beneficios |
|---|---|---|
| **Pro** | 1,000 Coins/mes | Pool reveal x3/día gratis, marcos exclusivos, sin ads en home |

**NO incluir**: Tickets como beneficio Pro (rompería la wall). Solo cosmetics y conveniencia.

---

## Sistema final v2.4 — diseño brutalmente simple

Cinco iteraciones llegaron al doc. Cada una rechazada por exceso de complejidad o problema económico. La conclusión: **el sistema más fuerte es el que el usuario entiende en 30 segundos**.

Solo dos formas de ganar Tickets, una sola forma de gastarlos. Cero caps complicados. Cero matemáticas mentales.

### Earning (2 mecanismos al lanzamiento)

| Mecanismo | Recompensa | Cap | Notas UI |
|---|---|---|---|
| **Daily Pick check-in** | 1 Ticket al hacer la predicción + 1 Ticket bonus si acierta | 1 predicción/día | "Hoy: Real Madrid vs Atlético — predice y gana 1 Ticket" |
| **Rewarded ad** | 1 Ticket | sin cap diario duro | "+1 Ticket" — NUNCA "+1 entrada al sorteo" |

### Spending (1 sumidero al lanzamiento)

| Acción | Costo |
|---|---|
| **Entrada al sorteo semanal** | 7 Tickets |

### Lo que el usuario ve en la UI

```
TUS TICKETS: 4

[ ⚽ Daily Pick: Real Madrid vs Atlético — predice ahora ]   +1 al predecir
[ ▶ Ver anuncio (+1 Ticket) ]                                sin límite

────────────────────────────────────────────────
SORTEO SEMANAL                          PREMIO: $250 MXN
Necesitas 7 Tickets para entrar (te faltan 3)
[ Entrar al sorteo ]                              (deshabilitado)
```

Mensaje legal en el footer del sorteo:

> "Sin compra obligatoria. Entrada gratis: predice 7 Daily Picks (uno por día durante una semana) = 1 entrada al sorteo. Ver bases del concurso."

### Earning rates por tipo de usuario

| Comportamiento | Tickets/sem | Entradas al sorteo |
|---|---|---|
| Daily Pick puro (sin ads, sin acertar nunca) | 7 | 1 |
| Daily Pick puro acertando ~50% | 10–11 | 1–2 |
| Daily Pick + 1 ad/día | 14–18 | 2 |
| Daily Pick + 3 ads/día | 28–32 | 4 |
| Heavy (Daily Pick + 5 ads/día) | 42–49 | 6–7 |

**AMOE garantizado**: aún sin acertar nunca el Daily Pick, 7 check-ins/sem = 7 Tickets = exactamente 1 entrada gratis al sorteo. **Cumple Apple Guideline 5.3 y LFJS MX perfectamente.**

### Revenue del premio

| Métrica | Valor |
|---|---|
| Usuarios activos/sem | 200 |
| Promedio ads vistos/usuario/día | 2 |
| Total ads/sem | 200 × 2 × 7 = 2,800 |
| eCPM rewarded MX (AdMob avg) | $8 USD |
| **Revenue ads/sem** | **~$22 USD** |
| Costo premio Amazon $250 MXN | $14 USD |
| **Margen del programa** | **~$8 USD/sem** |

Coin IAP revenue (~$42 USD/sem net @ 10% paying conversion) es **revenue completamente separado** — paga infra, dev, no se cuenta para el budget de premios. Es el cushion en caso de mal mes de eCPM. Más importante: **los Coin Sinks (S1–S5 más arriba) son donde está la complejidad estratégica del producto** y donde se hace el revenue principal del negocio.

### Backlog condicional (NO al lanzamiento, agregar solo si métricas lo justifican)

| Mecanismo | Cuándo activarlo |
|---|---|
| Welcome bonus (+3 Tickets one-time) | D1 retention < 50% |
| Streak bonus (+3 Tickets en día 7 consecutivo) | Check-in retention día 4–7 cae > 30% |
| Referrals (+5 referidor / +3 referido) | DAU growth orgánico < 5%/sem |
| Daily Wheel | DAU < MAU/2 (señal de falta de engagement diario más allá del Daily Pick) |
| Misiones de actividad ("usa 1 power-up", "termina top-3", etc.) | Cuando el sistema esté validado y haya superficie para misiones |
| Achievements one-time | Después de tener > 1k usuarios y telemetría de cohort |
| Cap diario de ads | Solo si fraud detection detecta farming |
| Caducidad de Tickets | Solo si > 5% de usuarios acumula > 50 Tickets sin gastar por más de 4 semanas |

**Regla de oro**: cada feature adicional cuesta dev, complica el UI, y diluye el mensaje "Daily Pick + ads = entrada". No se agrega nada por intuición, solo cuando una métrica concreta lo demande.

---

## Política de ads — riesgo y mitigación

**Lo que está permitido por AdMob (confirmado con precedentes vivos)**:

Rewarded ads donde la recompensa es **virtual currency in-app** (Tickets) que el usuario *puede luego decidir* gastar en participar en sorteos. Es exactamente el modelo de **Mistplay** (App Store ID 6739352969), **Lucktastic**, **Skillz** (ID 1114214294), **JustPlay**, **Cash Carnival**. Operan abiertamente con AdMob desde hace años sin suspensión.

**Lo que NO está permitido**:

- UI del ad que diga "+1 entrada al sorteo Amazon" (debe decir "+1 Ticket")
- Ser la única manera de entrar al sorteo (sin AMOE puro disponible)
- Ad farming / bots / fake views
- Targeting de jurisdicciones donde sorteos son ilegales

**Mitigaciones obligatorias antes de lanzar**:

1. **App Attest (iOS) / Play Integrity (Android)** activo en todos los endpoints de earning. Sin attestation válida no se otorga el Ticket.
2. **SSV (Server-Side Verification)** firmado por AdMob → backend valida cada ad view antes de dar el Ticket. Sin SSV no se otorga la recompensa.
3. **Ad mediation multi-red**: integrar AdMob como principal + Unity Ads + AppLovin como backups. Si AdMob suspende, los otros dos siguen sirviendo. **Crítico para no quedar varado.**
4. **Bases del Concurso** explícitas con AMOE: "El daily check-in (predicción del Daily Pick) sin compra ni ver anuncios alcanza para 1 entrada al sorteo cada semana."
5. **Apple no es patrocinador** disclaimer en bases (requisito de Apple Guideline 5.3).

**Riesgo residual aceptado**: Google podría interpretar el modelo como cross-line en cualquier momento y suspender AdMob. Por eso la mediation multi-red. Skillz y Mistplay han operado años así sin suspensión, lo que sugiere que la línea está bien donde la dibujamos.

---

> **Versiones superseded**: v1, v2, v2.1, v2.2, v2.3 quedaron en commit history. Todas se rechazaron por complejidad innecesaria. v2.4 es la versión que se construye.

---

## Reglas de balance defensivas (v2.4)

1. **Entry al sorteo semanal**: 7 Tickets fijos. Match exacto con 1 semana de check-in (AMOE perfecto).
2. **Sin wallet cap** al inicio. Si telemetría detecta hoarding (> 5% de usuarios acumulando > 50 Tickets sin gastar por más de 4 semanas), agregar caducidad de 4 semanas reactivamente.
3. **Sin max entries por sorteo** al inicio. El techo natural (~7 entradas para hardcore vs 1 para AMOE puro) ya da ratio razonable de 7:1. Solo agregar cap si data muestra abuso.
4. **Mínimo de 20 entradas por sorteo** o el premio se rolla a la siguiente semana (declarado en bases del concurso).
5. **Si nadie gana** (premio skill-based + nadie acierta): premio se acumula al siguiente sorteo, declarado en bases.
6. **Ad mediation multi-red obligatoria desde lanzamiento**: AdMob principal + Unity Ads + AppLovin como backup. Sin esto, una suspensión de AdMob varia el modelo.
7. **Auditoría mensual** del ratio paying-users/free-users, del ratio Tickets generados/gastados, y del eCPM real. Recalibrar reactivamente:
   - gen/gasto > 1.3 → considerar más sumideros (sorteo daily mini)
   - gen/gasto < 0.8 → activar 1 mecanismo del backlog condicional (Welcome bonus es el más barato)
   - eCPM cae > 30% → considerar bumpear cuota mínima de paying users vía Coin Sinks promo

---

## Lo que esto te commita a entregar (orden sugerido)

**Antes de Tickets** (3–5 sem dev) — fortalece el revenue side primero para tener budget de premios:
1. ☐ Implementar S2 power-ups (al menos Pick reveal + Late edit + Insurance) — alta velocidad de drenaje
2. ☐ Implementar S1 multi-entrada por pool
3. ☐ Implementar S3 cosmetics básicos (3–5 frames + 3 name colors)
4. ☐ Telemetría de coin sinks: dashboard admin con "coins spent / sink type / week"

**Después** (siguiendo el roadmap original): tickets infra → AMOE → ads → referrals → misiones → premium pools.

**Validación temprana**: con solo S2 + S3 + S5 implementados, mide 4 semanas de comportamiento de gasto. Si revenue Coins/sem ≥ $40 USD con la cohort actual, procede con Tickets. Si < $20, reforzar coin sinks antes de gastar dev time en Tickets.

---

## Catálogo original (v1, ahora superseded por v2 arriba)

### P0 — MVP (lanzar primero)

| Mecanismo | Recompensa | Cap | Función |
|---|---|---|---|
| **Daily check-in** | 1 Ticket/día | 1/día | **AMOE crítico** — la prueba legal de "no purchase necessary" |
| **Streak bonus** | +5 Tickets en día 7 | 1/semana | Retención |
| **Rewarded ads** | 1 Ticket / 3 ads | 5 ads/día | Boost (NUNCA exclusivo) |
| **Referral exitoso** | +10 al referidor, +5 al referido | sin cap | Growth (libera solo cuando referido entra a pool premiado) |
| **Welcome bonus** | 3 Tickets | one-time | Onboarding |

### P1 — Siguiente fase

- Misiones diarias ("haz picks en 3 quinielas gratis"): 1 Ticket/misión, cap 3/día
- Misiones semanales: 5 Tickets, 1/semana
- Rueda de la fortuna gratuita (1 spin/día gratis): 0–3 Tickets random
- Activar notificaciones push: 5 Tickets one-time
- Achievements milestones: 3–10 Tickets variable

### P2 — Engagement adicional

- Trivia diaria de fútbol (3 preguntas): 1 Ticket si aciertas las 3
- Compartir pool en RRSS: 1 Ticket, cap 1/día
- Vincular Apple/Google Sign In: 5 Tickets one-time
- Cumpleaños: 10 Tickets, 1/año
- Eventos especiales (Mundial 2026, Liga MX final): bonus duplicado

**Earning ceiling diario realista**: ~9 Tickets/día con engagement completo. Usuario AMOE puro: 7 Tickets/semana → 1 entrada al sorteo Amazon $250 MXN.

---

## Modelo de datos — Schema SQL

```sql
-- Extensiones a tabla users
ALTER TABLE users ADD COLUMN tickets_balance INT DEFAULT 0;
ALTER TABLE users ADD COLUMN last_checkin_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN streak_days INT DEFAULT 0;
ALTER TABLE users ADD COLUMN referral_code VARCHAR(12) UNIQUE;
ALTER TABLE users ADD COLUMN referrer_id BIGINT REFERENCES users(id);
ALTER TABLE users ADD COLUMN dob DATE;
ALTER TABLE users ADD COLUMN country_code CHAR(2);

-- Ledger inmutable de transacciones de Tickets
CREATE TABLE ticket_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  delta INT NOT NULL,
  source VARCHAR(50) NOT NULL,
  source_ref VARCHAR(100),
  balance_after INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, source_ref)
);

CREATE TABLE rewarded_ad_views (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  network VARCHAR(20) NOT NULL,
  ssv_token VARCHAR(500) NOT NULL UNIQUE,
  device_id VARCHAR(100),
  ip_addr INET,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ticket_awarded BOOLEAN NOT NULL
);

CREATE TABLE missions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  template_id VARCHAR(50) NOT NULL,
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
  referee_id BIGINT NOT NULL UNIQUE,
  triggered_pool_id BIGINT,
  awarded_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL
);

CREATE TABLE pool_entries_premium (
  id BIGSERIAL PRIMARY KEY,
  pool_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  tickets_spent INT NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pool_id, user_id)
);
```

**Crítico**: cero foreign keys entre `ticket_transactions` y la economía de Coins. Cero código que mute ambos balances en una transacción atómica.

---

## Endpoints REST nuevos

```
# Earning
POST   /users/me/rewards/checkin               # daily check-in
POST   /users/me/rewards/ad-watched            # confirma SSV de rewarded ad
POST   /admob/ssv-callback                     # webhook AdMob (firmado)
POST   /applovin/ssv-callback                  # webhook AppLovin (firmado)
POST   /users/me/rewards/wheel-spin            # rueda diaria
POST   /users/me/rewards/share                 # share event
POST   /users/me/rewards/notifications-enabled # push opt-in bonus
POST   /users/me/rewards/social-link           # vinculó Apple/Google
GET    /users/me/missions                      # misiones activas
POST   /users/me/missions/:id/claim            # reclamar misión completada
GET    /trivia/daily                           # preguntas del día
POST   /trivia/daily/submit                    # enviar respuestas

# Referrals
GET    /users/me/referral                      # mi código + stats
POST   /auth/register                          # extender body con referrer_code

# Tickets balance + ledger
GET    /users/me/tickets                       # balance + ledger paginado
GET    /users/me/tickets/transactions          # ledger detallado

# Pools premiados (sweepstakes)
GET    /pools/premium                          # lista de sorteos activos
POST   /pools/premium/:id/enter                # gasta Tickets para entrar (NUNCA Coins)
GET    /pools/premium/:id/rules                # bases del concurso
```

**Ningún endpoint de earning recibe `coin_amount`. Ninguno acepta pago.**

---

## Pantallas SwiftUI nuevas

```
futpoolsapp/
├── Features/
│   ├── Rewards/                          [NUEVO MÓDULO]
│   │   ├── RewardsHubView.swift
│   │   ├── RewardsHubViewModel.swift
│   │   ├── DailyCheckinCard.swift            # embed en HomeView
│   │   ├── RewardedAdButton.swift
│   │   ├── RewardedAdService.swift           # wrapper AdMob
│   │   ├── ReferralView.swift
│   │   ├── ReferralViewModel.swift
│   │   ├── MissionsView.swift
│   │   ├── MissionsViewModel.swift
│   │   ├── DailyWheelView.swift
│   │   ├── TriviaView.swift
│   │   └── TicketHistoryView.swift
│   ├── Pools/                            [NUEVO]
│   │   ├── PremiumPoolsListView.swift
│   │   ├── PremiumPoolDetailView.swift
│   │   └── ContestRulesView.swift            # bases embedded
│   └── Auth/
│       └── RegisterView.swift                # MODIFICAR: + DOB + country + referrer_code
├── Models/
│   ├── Tickets.swift                         [NUEVO]
│   ├── TicketTransaction.swift               [NUEVO]
│   ├── Mission.swift                         [NUEVO]
│   ├── PremiumPool.swift                     [NUEVO]
│   └── User.swift                            # MODIFICAR
├── Services/
│   ├── RewardsService.swift                  [NUEVO]
│   ├── TicketsService.swift                  [NUEVO]
│   └── APIClient.swift                        # extender
└── Core/Components/Arena/
    ├── TicketBadge.swift                     [NUEVO]
    └── DualBalancePill.swift                 [NUEVO]
```

### Impacto en pantallas actuales

| Pantalla | Cambio |
|---|---|
| `HomeView` | Embed `DailyCheckinCard`. Nueva sección "Pools Premiados". Header dual balance. |
| `MainTabView` | Mantener 4 tabs. Rewards Hub accesible desde ProfileView. |
| `ProfileView` | Sección "Mis Tickets" + "Mi código de invitación". |
| `RechargeView` | NO tocar. Solo agregar disclaimer al final. |
| `MakeQuinielaView` | Si pool es premium → bloquear, redirigir a `PremiumPoolDetailView`. |
| `QuinielaDetailView` | Badge "PREMIO REAL" + banner "Ver bases". |
| `RegisterView` | + DOB (18+), country picker (default MX), referrer_code (auto). |
| `SignupBonusCelebrationSheet` | "+50 Coins · +3 Tickets". |
| `SettingsView` | Sección "Términos del concurso" + disclaimer "Apple no es patrocinador". |

---

## Anti-fraude (crítico — Tickets = valor real)

- **Server-side enforcement** de TODOS los caps. Cliente nunca decide.
- **Idempotency keys** en cada endpoint (ej. `ssv_token` UNIQUE).
- **Apple App Attest** para verificar integridad de la app.
- **DeviceCheck / IDFV** para detectar device farms.
- **Rate limit por IP**: max 10 cuentas/24h desde misma IP.
- **Self-referral detection**: device fingerprint (IDFV + IP + email domain).
- **Sybil attack defense**: si usuario tiene >50 entries en sorteo → manual review.
- **Ledger inmutable**: `ticket_transactions` solo INSERT, nunca UPDATE/DELETE.
- **Panel admin**: extender `AdminDashboardView` con vista "Sospechosos".

---

## Calibración económica v2.4 (premio Amazon $250 MXN ≈ $14 USD)

Sorteo semanal con entry = 7 Tickets, 200 usuarios activos/sem:

| Métrica | Valor |
|---|---|
| Total ad views/sem (200 usuarios × 2 ads/día × 7) | 2,800 |
| eCPM rewarded MX (AdMob avg) | $8 USD |
| **Revenue ads/sem** | **~$22 USD** |
| Costo premio Amazon $250 MXN | $14 USD |
| **Margen del programa de Tickets** | **~$8 USD/sem** |

Coin IAP revenue (~$42 USD/sem net @ 10% paying conversion) es **revenue completamente separado** — paga infra y dev, no se mezcla con budget de premios. Es el cushion en caso de mal mes de eCPM.

**Si la cohort crece a 1,000 activos/sem** (5×): revenue ads ~$110 USD/sem → puedes tener premios de $50 USD semanales o varios premios en un mismo sorteo.

**Insight crítico**: el programa de Tickets se autosostiene con ads. La complejidad estratégica del producto está en los **Coin Sinks** (S1–S5 más arriba: power-ups, cosmetics, Pro tier) — eso es lo que mueve la aguja del revenue real del negocio. Tickets es solo el engagement engine que lleva al usuario a abrir la app y eventualmente convertir.

(Reglas de balance defensivas v2.4 ya documentadas en sección homónima más arriba.)

---

## Roadmap MVP v2.4 (~9–11 semanas dev + 2–6 semanas legal en paralelo)

| Fase | Duración | Entregables |
|---|---|---|
| **0 — Legal** (paralelo) | 2–6 sem | Opinión legal MX, permiso DGJS, bases redactadas con AMOE explícito, RFC entidad organizadora |
| **1 — Infra Tickets** | 1–2 sem | Schema DB (`tickets_balance`, `ticket_transactions`), endpoints `/tickets/*`, `Models/Tickets.swift`, dual balance visible en HomeView header |
| **2 — Daily Pick check-in** | 1–2 sem | `daily_picks` table + cron 00:00 local, `DailyPickCard.swift` (predicción 1/X/2 + +1 Ticket inmediato + +1 bonus si acierta), backend que valida acierto al FT del fixture |
| **3 — Rewarded ads + mediation** | 2 sem | AdMob SDK + Unity Ads + AppLovin (mediation multi-red), SSV backend firmado, App Attest (iOS) / Play Integrity (Android), `RewardedAdButton.swift` que muestra "+1 Ticket" |
| **4 — Pools premiados** | 2 sem | `PremiumPoolsListView`, `PremiumPoolDetailView` (entry = 7 Tickets), `ContestRulesView` con bases del concurso embebidas, flujo KYC ganador, CFDI |
| **5 — Age gate + país** | 1 sem | Refactor `RegisterView` (DOB 18+ obligatorio, country picker default MX), geo-restricción Apple solo MX al inicio |
| **6 — App Review prep + lanzamiento** | 1 sem | Description quirúrgica, App Review Notes con precedentes Mistplay/Skillz/Lucktastic, footer "Apple no es patrocinador", submit |

**Backlog condicional (vNext)** — agregar uno por uno solo cuando una métrica concreta lo justifique (criterios documentados en sección "Backlog condicional" de v2.4): Welcome bonus, Streak bonus, Referrals, Daily Wheel, Misiones de actividad, Achievements, Daily Trivia, eventos Mundial 2026.

---

## Próximos pasos accionables (cuando retomes)

### Pre-implementación (legal)
1. ☐ Agendar consulta con abogado mexicano especialista en gaming/sorteos (CDMX/MTY). Costo: $5,000–$15,000 MXN.
2. ☐ Solicitar opinión escrita sobre el modelo Camino B+ aplicado a Futpools.
3. ☐ Verificar URL/requisitos vigentes 2026 en gob.mx para "Permiso de Sorteo con Fines Promocionales".
4. ☐ Definir entidad legal organizadora (persona moral con RFC).
5. ☐ Redactar borrador de Bases del Concurso.

### Implementación técnica (en orden, una vez legal listo) — alineada con Roadmap MVP v2.4

1. ☐ **Fase 1 — Infra Tickets**: Schema SQL (`tickets_balance`, `ticket_transactions`) + endpoints `/tickets/*` + `Models/Tickets.swift` + dual balance visible en HomeView header.
2. ☐ **Fase 2 — Daily Pick check-in**: `daily_picks` table + cron 00:00 local que elige 1 fixture popular + `DailyPickCard.swift` (predicción 1/X/2 + +1 Ticket inmediato) + backend que valida acierto al FT del fixture y otorga +1 bonus.
3. ☐ **Fase 3 — Rewarded ads + mediation multi-red**: AdMob SDK + Unity Ads + AppLovin + SSV backend firmado + App Attest (iOS) / Play Integrity (Android) + `RewardedAdButton.swift` ("+1 Ticket", nunca "+1 entrada").
4. ☐ **Fase 4 — Pools premiados**: `PremiumPoolsListView` + `PremiumPoolDetailView` (entry = 7 Tickets) + `ContestRulesView` con bases del concurso embebidas + flujo KYC ganador + CFDI.
5. ☐ **Fase 5 — Age gate + país**: `RegisterView` refactor (DOB 18+ obligatorio, country picker default MX) + geo-restricción Apple solo MX.
6. ☐ **Fase 6 — App Store Connect prep**: categoría Sports/Entertainment, edad 17+, geo MX, description quirúrgica, App Review Notes con precedentes Mistplay/Skillz/Lucktastic, footer "Apple no es patrocinador".

**Backlog condicional (no implementar al MVP)**: Welcome bonus, Streak bonus, Referrals, Daily Wheel, Misiones de actividad, Achievements, Daily Trivia. Activar uno por uno cuando una métrica concreta lo demande (criterios en sección "Backlog condicional" de v2.4).

---

## Referencias clave

- **Apple Guidelines (sec. 5.3)**: https://developer.apple.com/app-store/review/guidelines/
- **LFJS México**: https://www.diputados.gob.mx/LeyesBiblio/pdf/109.pdf
- **DGJS SEGOB**: http://www.juegosysorteos.gob.mx/
- **Mistplay** (App Store ID 6739352969, precedente vivo): https://apps.apple.com/us/app/mistplay-play-games-earn-cash/id6739352969
- **Solitaire Cube / Skillz** (ID 1114214294): https://apps.apple.com/us/app/solitaire-cube-real-cash-game/id1114214294
- **Skillz iOS Store Rejections Guide**: https://docs.skillz.com/docs/ios-store-rejections/
- **Lexology AMOE doctrine**: https://www.lexology.com/library/detail.aspx?g=dccc3735-cbdb-4e3a-aecd-41f72ebeebb2
- **Quiniela Pro TOS** (modelo "no entregamos premios"): https://www.quinielapro.com/terms
- **Barush Sports** (modelo MX patrocinado): https://www.barushseminuevos.com/quiniela-barush-sports-liga-mx-premios-amazon-jerseys/
- **CBS Sports Pick'em Rules** (skill-based gratuito US): https://www.cbssports.com/fantasy/football/games/pickem/rules
- **WebNovel / ReelShort** (playbook UX dual currency): https://www.webnovel.com/, https://www.reelshort.com/
- **LISR arts. 137–139** (premios), **LFPC arts. 32, 46, 47** (Profeco), **CPF art. 257** (penal)

---

## Plan completo (investigación detallada)

El plan completo con todas las secciones (reglas de Apple, marco legal mexicano detallado, comparativa de apps existentes, los 4 caminos viables A/B/B+/C/D, diseño detallado de cada uno de los 15 mecanismos de earning) está guardado localmente en:

```
~/.claude/plans/investiga-profundamente-en-la-flickering-hanrahan.md
```

Este documento es un resumen accionable de ese plan completo.

---

> ⚠️ **Disclaimer**: Esta investigación NO constituye asesoría legal. La regulación mexicana de juegos y sorteos es un campo especializado y la autoridad ha mostrado criterios cambiantes. Antes de operar comercialmente con premios reales, valida con abogado mexicano especialista.
