# FutPools — SEO Landing Page Playbook

> Reusable rules + structure for shipping bottom-of-funnel SEO landing pages.
> Canonical reference implementation: **`src/pages/WorldCup2026Landing.jsx`**
> (the World Cup 2026 calendar landing). Copy it; don't reinvent it.
>
> **Language**: bilingual ES + EN when the keyword exists with real volume in
> both languages (calendar, Mexico) — both URLs go to Search Console. ES-only
> when the keyword is Spanish-native (quiniela, pronósticos): one route, one
> shell, no hreflang. An EN variant without its own keyword research is dead
> weight, not coverage.

---

## 0. The model (one page = one keyword, content + CTA → tool)

Based on the "bottom-of-funnel SEO landing page" template (Compact Keywords).
A landing is **content that ranks**; its CTA sends the visitor to the **tool**
that satisfies the intent. The landing is NOT a thin doorway — it carries real
content (sections, bullets, FAQ), so it ranks AND converts.

```
Search → Landing (/keyword-slug, content + H1 + CTA) → Tool (/keyword-slug/action) → Conversion
```

Architecture (information architecture / IA):
- **Landing** = the SEO page, e.g. `/calendario-mundial-2026` (priority 0.9).
- **Tool** = the utility under it, e.g. `/calendario-mundial-2026/agregar` (0.6, self-canonical).
- Keep a rational parent/child hierarchy so you can scale (`/calendario-mundial-2026/mexico`, etc.).

---

## 0b. Picking the keyword (Compact Keywords method — do this FIRST)

A landing only gets built after the keyword passes this filter. The tool's
difficulty score is NOT the filter — the SERP itself is.

1. **Bottom-of-funnel intent fit.** The searcher must want something our
   product (or a tool we can build) actually delivers. "pronosticos de futbol"
   → make predictions and compete: fit. "resultados de futbol ayer" → a scores
   archive we don't have: skip.
2. **Manual SERP weakness check** (the core of the method). Search the keyword
   (incognito, MX) and inspect the top 10 with Semrush/Ahrefs URL-level data:
   - **Page Authority of the ranking URLs is what matters** — not the domains'
     DA, not the tool's KD%. PA < ~30 pages in the top 10 = beatable.
   - **Weak-content tells**: a forum thread, a Reddit/Quora answer, an app-store
     listing, a generic homepage (not a dedicated page) ranking = Google can't
     find a good dedicated page. That slot is winnable.
   - Real example (2026-06-12): "pronosticos futbol hoy" showed Semrush KD 70%
     ("Hard") but the top 10 included PA 13 pages, a forum and a Play Store
     listing → greenlit. The KD number alone would have killed it.
3. **Volume is secondary.** Low-volume bottom-of-funnel keywords convert;
   high-volume informational ones bounce. 1K/mo MX with weak SERP beats
   20K/mo with fortified SERP.
4. **One keyword = one page**, and variants ("de futbol hoy", "para hoy",
   "futbol para hoy") are the SAME page — Google stems them. A different
   *intent* (hoy vs general vs team-specific) is a different page.
5. **Match the intent's freshness.** If the keyword implies "now/today",
   a static page loses: pair evergreen baked copy with a dynamic client-side
   module (see §7b). If it implies a season/event, keep copy evergreen and
   let visuals/tools carry the specifics.

---

## 1. Content template (what goes on the page)

Fill this out (ES + EN) BEFORE writing code — it's the authoring template:

| Field | Rule |
|---|---|
| **Primary keyword** | One per page. The whole page targets it. |
| **Secondary keywords** | 2–5 related terms; weave into H2s + copy. |
| **URL slug** | The keyword, **hyphen-separated, lowercase** (`calendario-mundial-2026`). Never run words together in a path. |
| **`<title>`** | `[Primary Keyword]: [kw2], [kw3] \| FutPools`. Keyword first. ≤ 60 chars ideal. |
| **Meta description** | Lead with the keyword. Compelling. ~150–160 chars. |
| **H1** | The primary keyword (exactly one `<h1>` on the page). |
| **Intro** | First sentence **leads with the keyword**. ~3 sentences, short and punchy. |
| **Primary CTA (top)** | Button → the tool. Right after the intro. |
| **H2 sections** | As many as needed (≥4). Each: 1–2 punchy sentences + a bullet list. Put the keyword in several H2s. |
| **CTA (bottom)** | Repeat the primary CTA. Add a secondary conversion CTA (e.g. → onboarding). |
| **FAQ** | 4–6 Q&A. The visible CONTENT is the value (captures long-tail queries); the FAQPage JSON-LD is now optional — Google removed FAQ rich results from Search on 2026-05-07 (and retires the GSC FAQ report in June 2026). |

Copy style (from the video): sentences **short and punchy** (often one line),
paragraphs of 1–3 sentences, **bullets everywhere**. No fluff.

**No em dashes (—) anywhere in user-visible text** (user rule, 2026-06-11: they
read as AI-generated; real people don't write with them). Use a comma, colon,
period or parentheses instead. Applies to titles, meta descriptions, OG/Twitter
tags, intros, bullets, FAQ answers and JSON-LD. `·` as a separator in HUD
labels/visual chips is fine; so is `—` as an empty-value placeholder in UI.
Kickers must read like natural Spanish labels (category · country), not
abstract slogans.

**Section rhythm (Reverb-style):** alternate centered **statement** sections
(`<Statement>` — no visual, big centered H2 + 1 sentence) with two-column
**copy + visual** sections (`<Split>`, visual side alternates via `flip`). This
gives variety instead of a wall of identical cards.

---

## 2. Technical SEO checklist (every landing)

- [ ] **Canonical** — self-referencing, per locale. Baked into the static shell **and** set client-side. (`build-i18n-shells.js` + `setCanonical`)
- [ ] **hreflang** — `es`, `en`, `x-default` in `index.html` + the EN shell.
- [ ] **Open Graph + Twitter Card** — title/description/image per locale (`index.html` base + `build-i18n-shells.js` ES→EN map).
- [ ] **JSON-LD** — `BreadcrumbList` (still produces a visible result) + optionally `FAQPage`, per locale, **baked into the shell** (not only client-side) so non-JS crawlers see it. Single source: a `src/seo/<page>.js` module imported by BOTH the component and `build-i18n-shells.js`. **The shell `<script>` and the component's `setJsonLd` MUST share the SAME id `landing-jsonld`** — same id across ALL landings — so the client UPDATES the one element instead of adding a duplicate (and SPA navigation between landings never leaves two blocks). The rule applies to ANY schema type: duplicated/invalid structured data still gets flagged. *Status 2026-06: FAQ rich results were removed from Google Search on 2026-05-07, so `FAQPage` markup no longer yields a rich result — keeping it is harmless (and existing landings keep theirs), but it's no longer mandatory for new pages.*
- [ ] **Per-locale static shell** — `dist/<es-slug>/index.html` + `dist/<en-slug>/index.html` with correct `<title>`/meta/canonical/JSON-LD, so crawlers get the right language without running JS.
- [ ] **Sitemap** — add both slugs to `sitemapController.js` (`STATIC_ROUTES`) with hreflang alternates (landing 0.9, tool 0.6) **and** to `public/sitemap.xml` (static fallback). All `<loc>` use `https://futpools.com`.
- [ ] **robots.txt** — already points to the sitemap; ensure the landing isn't disallowed.
- [ ] **301 on URL change** — never rename a live slug without a 301 in `public/_redirects` (before the catch-all) + a client `<Navigate>` in `App.jsx`.
- [ ] **Internal links (NO ORPHANS)** — link the landing from the public home (`LandingPage.jsx` nav + footer), locale-aware. An orphan page (only in the sitemap) under-ranks. This is the easiest gap to forget.
- [ ] **Bilingual** — every string via `c(es, en)`; both URLs submitted to Search Console.
- [ ] **Image alts** — SVG/CSS visuals: `role="img"` + bilingual `aria-label` on the visual root (decorative inner SVG → `aria-hidden`).

---

## 3. Design system & visuals

Reuse the **WC26 HUD aesthetic** — do NOT introduce a new look per page:
- Import `WC_CSS` from `WorldCup2026Calendar.jsx` (shared nav/hero/footer/CTA/buttons + tokens: Oxanium display, neon green `#21E28C`, cyan `#36E9FF`, magenta `#FF2BD6`, clip-path corner-cuts, scanlines, perspective grid).
- Add a page-specific `LANDING_CSS` block for the content sections.

**Hero = Reverb layout (user rule, 2026-06-11): copy left, visual right,
above the fold.** Kicker + H1 + lead + CTA + stats left-aligned in one column;
a product-style visual (the page's phone mockup or strongest visual) in the
right column, visible without scrolling — it signals "content worth seeing"
and cuts bounce. Markup: `<header className="wc-hero wc-hero-split">` with
`.wc-hero-copy` + `.wc-hero-visual` inside `.wc-hero-inner`; the grid CSS
lives in `LANDING_CSS` and stacks (text first) on mobile. Never center the
hero CTA row on these pages.

**Visuals = hand-built SVG/CSS, never raster.** They stay crisp at any DPI,
weigh ~0 KB, cause no layout shift, and stay on-brand. Patterns in the WC26 page
you can reuse: distribution bars, a phases stepper, a dotted region map, a
timezone list, a phone mockup. One well-orchestrated staggered load
(`animation-delay`) beats scattered micro-animations.

**Accuracy is non-negotiable.** Never invent data (e.g. specific match
fixtures that depend on a draw). Use only verified facts (dates, venues,
distribution). Web-search to confirm before publishing.

---

## 4. File map (where each thing lives)

| Concern | File |
|---|---|
| Landing component (reference) | `src/pages/WorldCup2026Landing.jsx` |
| Tool component | `src/pages/WorldCup2026Calendar.jsx` (exports `WC_CSS`) |
| FAQ + JSON-LD (shared source) | `src/seo/wc26Landing.js` |
| Routes + legacy `<Navigate>` | `src/App.jsx` |
| 301 redirects | `public/_redirects` |
| Per-locale shells + canonical + JSON-LD | `scripts/build-i18n-shells.js` |
| Base `<title>`/meta/OG/hreflang | `index.html` |
| Sitemap (dynamic) | `futpools_backend/src/controllers/sitemapController.js` |
| Sitemap (static fallback) | `public/sitemap.xml` |
| Internal link from public home | `src/pages/LandingPage.jsx` (nav + footer) |

---

## 5. Ship a new landing — step by step

1. **Fill the content template** (§1) in ES + EN: keyword, slugs, title, meta, H1, intro, H2s, FAQ.
2. **Copy `WorldCup2026Landing.jsx`** → new component. Replace copy/visuals; keep the `Statement`/`Split` rhythm and the SEO head helpers.
3. **Create `src/seo/<page>.js`** (copy `wc26Landing.js`): FAQ data `{ q:{es,en}, a:{es,en} }` + `<page>JsonLd(locale)`. Import it in the component AND the shell script.
4. **Routes** in `App.jsx`: landing (es/en) → component; tool (es/en) → tool; legacy `<Navigate>` if replacing a URL.
5. **Shells** in `build-i18n-shells.js`: add the ES→EN substitutions for the new title/meta/OG, the new shell dirs, canonical + JSON-LD injection per locale.
6. **`index.html`**: keyword-led `<title>`/meta/OG/hreflang for the new landing (if it's the primary share target).
7. **Sitemap**: add both slugs to `sitemapController.js` + `public/sitemap.xml` (landing 0.9 + hreflang, tool 0.6).
8. **301** in `public/_redirects` if you renamed a live slug.
9. **Internal link**: add to `LandingPage.jsx` nav + footer (locale-aware). **Do not skip.**
10. **QA** (§6) → deploy → submit both URLs in Search Console + Rich Results Test.

---

## 6. Pre-publish QA (run before deploy)

```bash
# Build generates the per-locale shells + sitemap snapshot
SITEMAP_API_URL=http://localhost:3000 npm run build

# Shells exist with the right title + canonical + per-locale JSON-LD
grep -o '<title>[^<]*' dist/<es-slug>/index.html dist/<en-slug>/index.html
grep -c 'application/ld+json' dist/<es-slug>/index.html dist/<en-slug>/index.html

# Sitemap has both slugs (+ hreflang) and is valid XML
curl -s http://localhost:3000/sitemap.xml | grep -c '<loc>'
python3 -c "import xml.dom.minidom as m; m.parse('dist/sitemap.xml'); print('valid')"

# CRITICAL: exactly ONE application/ld+json per shell, and its id MUST match
# the component's setJsonLd id (else the client adds a 2nd → Google flags
# "FAQPage duplicated"). Verify BOTH:
grep -c 'application/ld+json' dist/<es-slug>/index.html dist/<en-slug>/index.html   # → 1 each
grep -o 'id="[a-z0-9-]*jsonld"' dist/<es-slug>/index.html                            # matches setJsonLd('<id>')

# Exactly one <h1>; CTAs top + bottom; internal link present
grep -c '<h1' src/pages/<Component>.jsx
grep -rn '<es-slug>\|<en-slug>' src/pages/LandingPage.jsx   # internal link wired
```

After deploy: `curl -sI` the old slug → expect **301**; open both URLs (table-styled
sitemap, correct `<title>`); **run Google's Rich Results Test on each locale BEFORE
requesting indexing** — it catches duplicate/invalid structured data (e.g. a 2nd
schema block from shell + client both injecting). This step is mandatory, not
optional. What "pass" means since 2026-05: **zero invalid/duplicate items** and a
valid BreadcrumbList; FAQ no longer appears as a rich result (discontinued by
Google), so don't expect or chase it.

---

## 7b. Validated patterns (shipped landings)

**Reuse the shared primitives** — they're exported from `WorldCup2026Landing.jsx`:
`Statement`, `Split`, `LANDING_CSS`, `setMeta`, `setCanonical`, `setJsonLd`
(and `WC_CSS` from `WorldCup2026Calendar.jsx`). A new landing = import these +
write copy + 2–3 page-specific SVG visuals + a `MX_CSS`-style block. Don't
re-implement the rhythm or head helpers.

**Team / topic-cluster landings** (e.g. `MexicoWorldCup2026.jsx`,
`/mexico-mundial-2026` · `/mexico-world-cup-2026`):
- They are **children** of the pillar calendar landing. Cross-link both ways:
  pillar → cluster (contextual link in a section) and cluster → pillar
  (secondary CTA). Plus the public-home footer links each one. This is the
  topic cluster — it's what makes the IA from the video pay off.
- The CTA **deep-links into the shared tool pre-filtered**:
  `…/agregar?team=mexico`. The tool reads `?team=` and selects the matching
  team on load (`WorldCup2026Calendar.jsx`). One tool, many entry points.
- Data lives in `src/seo/<team>.js` (verified fixtures + FAQ + JSON-LD),
  imported by the component AND the shell script — single source.

**ES-only / evergreen landings** (e.g. `QuinielaDeLaSemana.jsx`,
`/quiniela-de-la-semana` — Progol "quiniela de la semana"): no `c()` bilingual,
single route, single shell, and **no hreflang** (the shell swaps the calendar's
hreflang block out, self-canonical only). For **time-sensitive** topics (a weekly
pool whose matches change every jornada) keep the copy **evergreen** — explain how
it works, label illustrative visuals "ejemplo", and never hardcode a specific
week. (A dynamic data-backed "this week" section is a separate, larger build.)
Also: for third-party brands (Progol/Lotería Nacional) state non-affiliation in
the FAQ + footer.

**Dynamic CTA landings** (e.g. `PronosticosFutbol.jsx`, `/pronosticos-de-futbol`):
the CTA can target live product state via a **public no-auth endpoint**
(`GET /public/pools/next-open` → next public pool still open for registration,
i.e. computed status `scheduled`; 60s in-memory cache; returns `200 + {pool:null}`
on the empty state so the client's >=400-throws path stays quiet). Rules:
- The **default render state is the evergreen fallback** (`/onboarding` CTA +
  undated copy) — initial paint, fetch failure, and crawler snapshots are always
  valid. The fetched pool only *upgrades* the CTA/card client-side.
- Never put fetched data (dates, names) into `document.title`/meta/JSON-LD —
  the baked shell stays evergreen; dynamic content is body-only enhancement.
- New public endpoints go in `futpools_backend/src/routes/public.js`
  (read-only, minimal payload, no auth) and reuse the canonical status logic
  (`computePoolStatus` exported from `quinielaController.js`) — don't duplicate
  the "registration open" definition.

**Freshness ("hoy") landings** (e.g. `PronosticosFutbolHoy.jsx`,
`/pronosticos-futbol-hoy`): when the keyword demands TODAY's content, bake
everything SEO-visible evergreen (title/meta/H1/FAQ/JSON-LD carry no dates)
and satisfy the daily intent with a **dynamic client-side module**:
`GET /public/fixtures/today` (CDMX calendar day, priority-league filter,
10-min server cache) renders today's real matches in the hero visual.
Crawlers that execute JS see fresh content on every crawl (`changefreq:
daily` in the sitemap); a fetch failure falls back to "ejemplo" rows so the
page never renders broken. These pages are cluster children — cross-link
pillar ↔ hoy both ways.

**Additional shells** in `build-i18n-shells.js` = string-swap the calendar head
(present in `baseHtml`) → the new page's, per locale, via the `swap()` helper
(it warns if a source string drifts). Inject canonical + JSON-LD. Add both
slugs to the sitemap (`sitemapController.js` + `public/sitemap.xml`).

## 7. Honest defaults / decisions baked in

- **Tool pages are self-canonical** (different intent: "add to Google Calendar"
  long-tail), lower sitemap priority. They don't compete with the landing's head term.
- **The root `/` shell has no canonical/JSON-LD** for a specific landing — it's
  the home (`LandingPage`), not a landing. Only the landing shells get them.
- **`build-sitemap.js` race on first deploy:** the web build fetches the backend
  sitemap; if the backend is mid-deploy it may snapshot the old one (or fall back
  to `public/sitemap.xml`). Re-deploy the web after the backend is live, or rely
  on the static fallback (which we keep current).
