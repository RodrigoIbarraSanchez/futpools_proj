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

## Catálogo de mecanismos de earning de Tickets

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

## Calibración económica (premio Amazon $250 MXN ≈ $14 USD)

Sorteo semanal con 100 entradas (entrada = 5 Tickets):

| | Estimación |
|---|---|
| 100 entradas × 5 Tickets = 500 Tickets/semana | costo de oportunidad |
| eCPM rewarded ads MX: $5–15 USD | 1 ad ≈ $0.005–0.015 USD |
| Si 30% entries vienen de ads (~450 ads) | revenue: $4.50–13.50 USD |
| Costo del premio | $14 USD |
| **Subsidio neto** | **~$0.50 a $9.50 USD/semana** |

Compensación: Coins IAP es el revenue principal. Tickets = engagement engine.

**Reglas de negocio defensivas**:
- Tickets caducan al cierre del sorteo correspondiente.
- Cap absoluto de Tickets en wallet: 200.
- Al ganar, Tickets restantes pasan a 0.
- Sorteo necesita mínimo de participantes (ej. 20) o rolling-over a la siguiente semana (declarado en bases).

---

## Roadmap sugerido (14–20 semanas dev + 2–6 semanas legal en paralelo)

| Fase | Duración | Entregables |
|---|---|---|
| **0 — Legal** (paralelo) | 2–6 sem | Opinión legal MX, permiso DGJS, bases redactadas, RFC entidad |
| **1 — Infra Tickets** | 1–2 sem | Schema DB, endpoints `/tickets/*`, `Models/Tickets.swift`, balance dual visible |
| **2 — AMOE + Welcome** | 1 sem | Daily check-in, streak, welcome bonus, `DailyCheckinCard` |
| **3 — Rewarded ads** | 2 sem | AdMob SDK, SSV backend, `RewardedAdButton`, App Attest |
| **4 — Referrals** | 1–2 sem | Sistema completo, deep links, anti-self-referral |
| **5 — Misiones** | 1–2 sem | Engine, cron jobs, `MissionsView` |
| **6 — Pools premiados** | 2 sem | `PremiumPoolsListView`, `ContestRulesView`, KYC ganador, CFDI |
| **7 — Age gate + país** | 1 sem | Refactor `RegisterView` (DOB 18+, country), geo-restricción Apple solo MX |
| **8 — App Review prep** | 1 sem | Description quirúrgica, App Review Notes con precedentes |
| **9 — Beta TestFlight** | 2 sem | Validación end-to-end con permiso SEGOB activo |
| **10 — Lanzamiento** | — | Submit a App Store con review notes completas |
| **11 (opcional)** | — | Rueda, trivia, achievements, eventos Mundial 2026 |

---

## Próximos pasos accionables (cuando retomes)

### Pre-implementación (legal)
1. ☐ Agendar consulta con abogado mexicano especialista en gaming/sorteos (CDMX/MTY). Costo: $5,000–$15,000 MXN.
2. ☐ Solicitar opinión escrita sobre el modelo Camino B+ aplicado a Futpools.
3. ☐ Verificar URL/requisitos vigentes 2026 en gob.mx para "Permiso de Sorteo con Fines Promocionales".
4. ☐ Definir entidad legal organizadora (persona moral con RFC).
5. ☐ Redactar borrador de Bases del Concurso.

### Implementación técnica (en orden, una vez legal listo)
1. ☐ **Fase 1**: Schema SQL + endpoints `/tickets/*` + `Models/Tickets.swift` + dual balance visible en HomeView header.
2. ☐ **Fase 2**: Daily check-in (`DailyCheckinCard.swift` + `POST /users/me/rewards/checkin` + streak logic).
3. ☐ **Fase 3**: AdMob SDK integration + SSV backend + `RewardedAdButton`.
4. ☐ **Fase 4**: Referrals (deep link `futpools://r/<code>` + anti-fraude).
5. ☐ **Fase 5**: Misiones engine.
6. ☐ **Fase 6**: Premium pools UI + `ContestRulesView` embedded.
7. ☐ **Fase 7**: `RegisterView` refactor (DOB + country + referrer_code).
8. ☐ **Fase 8**: App Store Connect prep (categoría Sports/Entertainment, edad 17+, geo MX, description quirúrgica, App Review Notes con precedentes Mistplay/Skillz).

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
