# SEO Landing Playbook — Adaptación a WordPress + Elementor (Yoast, 1 idioma)

> Cómo producir las mismas landings bottom-of-funnel del playbook de FutPools
> (`SEO_LANDING_PLAYBOOK.md`) en un sitio **WordPress + Elementor** con
> **Yoast SEO** (gratis) y **un solo idioma**.
>
> La **metodología** del playbook se traslada 1:1 (1 página = 1 keyword,
> plantilla de contenido, schema, enlazado interno, QA). La **implementación**
> React (shells, sitemapController, WC_CSS) NO se traslada — en WordPress eso
> lo hacen Elementor + Yoast + un plugin de redirects.

---

## 0. Qué se traslada y qué no

| Capa | ¿Se traslada? | En WordPress lo hace… |
|---|---|---|
| Modelo 1 página = 1 keyword, contenido + CTA → conversión | ✅ Igual | Tú (estructura de la página) |
| Plantilla de contenido (slug/title/meta/H1/intro/H2/FAQ) | ✅ Igual | Kit de contenido (ver §6) |
| Ritmo visual Statement/Split alternado | ✅ Igual | Secciones de Elementor |
| Canonical, OG, sitemap, robots | ✅ Concepto | **Yoast** (automático por página) |
| JSON-LD FAQPage | ✅ Concepto | **Widget HTML** con el JSON-LD del kit |
| JSON-LD BreadcrumbList | ⚠️ **NO manual** | **Yoast lo emite solo** (ver §4 — duplicarlo es error) |
| Shells por idioma / hreflang | ❌ N/A | Sitio de 1 idioma |
| `_redirects` (301) | ✅ Concepto | Plugin **Redirection** (gratis) |
| Visuales SVG/CSS a código | ❌ | Widgets/imágenes de Elementor |

**Stack asumido:** Elementor (free sirve; Pro ayuda con Theme Builder),
**Yoast SEO free**, plugin **Redirection** (para 301s — Yoast free no trae
gestor de redirects).

---

## 1. Setup una sola vez (antes de la primera landing)

1. **Permalinks:** Ajustes → Enlaces permanentes → "Nombre de la entrada"
   (URLs limpias `/keyword-slug`).
2. **Yoast:** verifica que el sitemap esté activo (`/sitemap_index.xml`) y
   envíalo en Search Console. Configura la pestaña de datos del sitio
   (Organization, logo) — eso alimenta el @graph automático.
3. **Redirection:** instálalo y déjalo monitoreando cambios de slug.
4. **Plantilla Elementor:** construye **una vez** el esqueleto (§3), guárdalo
   como Template (`Guardar como plantilla`) y duplícalo por cada keyword.

---

## 2. Mapeo elemento por elemento (playbook → WP/Yoast/Elementor)

| Elemento del playbook | Dónde se hace en WordPress |
|---|---|
| **URL slug** (keyword con guiones) | Permalink de la página (editar slug al crearla) |
| **`<title>`** | Yoast → "Apariencia en el buscador" → Título SEO. Formato: `[Keyword] — [kw2], [kw3] \| [Marca]`. Keyword al inicio, ≤60 chars |
| **Meta description** | Yoast → Meta descripción (~150–160 chars, keyword al inicio) |
| **Canonical** | Yoast lo pone solo (self-canonical). Override solo en pestaña "Avanzado" si hace falta |
| **Open Graph / Twitter** | Yoast → pestaña "Social" de la página (título, descripción, imagen 1200×630) |
| **H1 (uno solo)** | Widget **Heading** con etiqueta **H1** en el hero. TODOS los demás headings = H2 (cuidado: muchos temas/widgets traen H2/H3 por defecto — revisa la etiqueta de cada Heading) |
| **Intro (keyword al inicio)** | Widget **Text Editor** bajo el H1, ~3 frases |
| **CTA primario (arriba y abajo)** | Widget **Button** → tu conversión (registro/WhatsApp/form) |
| **Secciones H2 + bullets** | Heading (H2) + **Icon List** dentro de la estructura del §3 |
| **FAQ visible** | Widget **Accordion** (free) o Toggle. **Sin** schema propio |
| **FAQ schema** | Widget **HTML** con el JSON-LD del kit — **solo FAQPage** (§4) |
| **Breadcrumb schema** | Nada que hacer: Yoast lo emite automáticamente |
| **Sitemap** | Yoast automático — solo verifica que la página aparezca |
| **robots** | Yoast → no marcar "noindex" (default ya es index) |
| **301 al renombrar slug** | Plugin Redirection (origen → destino, 301) |
| **Enlace interno (no-huérfanas)** | Menú/footer (Apariencia → Menús o el footer de Elementor) + 1 link contextual desde otra página relevante |
| **Datos verificados** | Igual que siempre: nunca inventar; verificar antes de publicar |

---

## 3. Receta de página en Elementor (el esqueleto, sección por sección)

Replica el ritmo Statement/Split del playbook. Estilo: usa los colores/fuentes
de TU tema (Site Settings → Global), no inventes un look por página.

1. **HERO** — sección 1 columna, centrada:
   - Heading **H1** = keyword · Text Editor (intro 3 frases, keyword al inicio)
   - Button (CTA primario) · opcional: fila de 3–4 stats (Inner Section con Headings)
2. **STATEMENT** — sección 1 columna centrada, mucho aire:
   - Heading H2 grande + Text Editor de 1 frase. (Separa los bloques densos.)
3. **SPLIT A** — sección 2 columnas (60/40):
   - Izq: Heading H2 + Text Editor (1–2 frases) + **Icon List** (bullets)
   - Der: Image/Video/widget visual
4. **SPLIT B** — igual pero columnas invertidas (40/60, visual a la izquierda)
5. *(Repite Statement/Split según el contenido — mínimo 4 secciones H2)*
6. **FAQ** — Heading H2 "Preguntas frecuentes" + **Accordion** (4–6 ítems)
   + **widget HTML** (oculto visualmente, no importa dónde) con el JSON-LD
7. **CTA FINAL** — sección centrada: H2 + texto + Button primario + botón
   secundario (link a otra página del cluster)

> Móvil: revisa el modo responsive de Elementor — los Splits deben apilarse
> (columna visual abajo) y el H1 escalar bien.

---

## 4. Schema en WordPress — las 2 reglas anti-duplicado (CRÍTICO)

Yoast emite **automáticamente** en cada página un `@graph` con `WebPage`,
`WebSite`, `Organization` y **`BreadcrumbList`**. Por lo tanto:

1. **El JSON-LD manual contiene SOLO `FAQPage`.** Nunca BreadcrumbList ni
   Organization ni WebPage — ya existen vía Yoast y duplicarlos invalida la
   elegibilidad de rich results (mismo error "campo duplicado" que vivimos en
   FutPools con FAQPage).
2. **Un solo emisor de FAQ schema.** Si pegas el JSON-LD manual, el widget
   Accordion debe ser "tonto" (visual). No instales/actives además un widget o
   plugin de FAQ que emita su propio schema.

Formato del bloque (va en un widget HTML de la página):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "PREGUNTA 1",
      "acceptedAnswer": { "@type": "Answer", "text": "RESPUESTA 1 (mínimo ~20 caracteres)" } }
  ]
}
</script>
```

> Las preguntas/respuestas del JSON-LD deben **coincidir** con las del
> Accordion visible (Google compara contenido visible vs marcado).

---

## 5. Checklist por página (espejo del playbook §5)

- [ ] Kit de contenido completo (§6) ANTES de tocar Elementor
- [ ] Datos verificados (web-search) — nunca inventar
- [ ] Página duplicada desde la plantilla; slug = keyword con guiones
- [ ] H1 único (verifica las etiquetas de todos los Headings)
- [ ] Yoast: Título SEO + meta description + pestaña Social
- [ ] CTA arriba y abajo
- [ ] Accordion FAQ + widget HTML con JSON-LD **solo FAQPage**
- [ ] Link interno desde menú/footer + 1 contextual (NO huérfana)
- [ ] Si reemplaza una URL vieja → 301 en Redirection
- [ ] QA (§7) → publicar → Search Console: inspeccionar URL + solicitar indexación

## 6. Formato del "kit de contenido" (lo que se genera por keyword)

Por cada keyword se entrega esto, listo para pegar:

```
KEYWORD PRIMARIA:   …          SECUNDARIAS: …, …
SLUG:               /keyword-con-guiones
TITULO SEO (Yoast): [Keyword] — [kw2], [kw3] | [Marca]      (≤60)
META DESCRIPTION:   … (~155, keyword al inicio)
H1:                 [Keyword]
INTRO (3 frases):   …
SECCIONES (≥4):     H2 + 1–2 frases + bullets  (alternar Statement/Split)
FAQ (4–6):          P/R que coincidirán con el Accordion
JSON-LD:            bloque <script> FAQPage listo para el widget HTML
LINKS INTERNOS:     desde dónde se enlaza esta página + a dónde enlaza ella
```

## 7. QA post-publicación (obligatorio, antes de pedir indexación)

1. **Rich Results Test** (search.google.com/test/rich-results) sobre la URL
   publicada: debe salir **1 FAQPage + 1 BreadcrumbList (el de Yoast), sin
   duplicados ni errores**. ← Este paso nos habría ahorrado el error en GSC.
2. Ver código fuente: **un solo** `<h1>`, **un solo** bloque FAQPage.
3. `/sitemap_index.xml` incluye la página.
4. Click al link interno (menú/footer) → llega a la página.
5. Si hubo cambio de slug: la URL vieja responde **301** a la nueva.
6. Search Console → Inspección de URL → "Probar URL publicada" (verde) →
   **Solicitar indexación**.

## 8. No-negociables (heredados del playbook)

- 1 página = 1 keyword primaria. 1 solo H1. Sin páginas huérfanas.
- Exactamente **1** FAQPage por página; **0** BreadcrumbList manuales (Yoast).
- Frases cortas, bullets, intro con la keyword al inicio. Nada de relleno.
- Datos verificados; temas que cambian en el tiempo → copy evergreen +
  visuales marcados "ejemplo".
- Marcas de terceros → disclaimer de no-afiliación (FAQ + footer).
- Rich Results Test SIEMPRE antes de solicitar indexación.

---

## 9. Página piloto — ejemplo trabajado (formato completo)

> Ejemplo demostrativo del formato del kit. Los datos del negocio van como
> `[PERSONALIZAR]` — sustituye con los datos reales de TU sitio (regla: no
> inventar). Keyword de ejemplo: **"clases de [SERVICIO] en [CIUDAD]"**.

```
KEYWORD PRIMARIA:   clases de [SERVICIO] en [CIUDAD]
SECUNDARIAS:        precios de clases de [SERVICIO], clases de [SERVICIO] para principiantes
SLUG:               /clases-de-[servicio]-en-[ciudad]
TITULO SEO:         Clases de [SERVICIO] en [CIUDAD] — precios y horarios | [MARCA]
META DESCRIPTION:   Clases de [SERVICIO] en [CIUDAD] para todos los niveles. Horarios
                    flexibles, precios desde $[X] y primera clase de prueba. Inscríbete hoy.

H1: Clases de [SERVICIO] en [CIUDAD]

INTRO:
Las clases de [SERVICIO] en [CIUDAD] de [MARCA] son para todos los niveles,
desde principiante hasta avanzado. Elige horario, conoce los precios y agenda
tu primera clase en minutos. [Gancho diferenciador — PERSONALIZAR].

[CTA: "Agendar mi clase" → formulario/WhatsApp]

H2 · ¿Qué incluyen las clases de [SERVICIO]?      (Split — foto del lugar/clase)
1 frase + bullets: duración · tamaño de grupo · niveles · materiales

H2 · Precios de las clases de [SERVICIO] en [CIUDAD]   (Split invertido — tabla/imagen)
1 frase + bullets: plan individual · plan grupal · paquetes · primera clase

STATEMENT · "Aprende [SERVICIO] sin complicarte"  (1 frase centrada)

H2 · Horarios y ubicación                          (Split — mapa)
bullets: días/horas · dirección · estacionamiento/transporte

H2 · Cómo inscribirte en 3 pasos                   (Split invertido — pasos)
bullets: 1. Agenda · 2. Clase de prueba · 3. Elige tu plan
[CTA repetido]

FAQ (Accordion + JSON-LD):
1. ¿Cuánto cuestan las clases de [SERVICIO] en [CIUDAD]?  → respuesta con precio real
2. ¿Necesito experiencia previa?                           → …
3. ¿Qué incluye la primera clase?                          → …
4. ¿Qué horarios hay disponibles?                          → …
5. ¿Dónde están ubicados?                                  → …

LINKS INTERNOS: footer + menú "Clases"; contextual desde el home y el blog.
```

JSON-LD del piloto (pegar en el widget HTML, sustituyendo las respuestas):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "¿Cuánto cuestan las clases de [SERVICIO] en [CIUDAD]?",
      "acceptedAnswer": { "@type": "Answer", "text": "[Respuesta real con precios — PERSONALIZAR]" } },
    { "@type": "Question", "name": "¿Necesito experiencia previa?",
      "acceptedAnswer": { "@type": "Answer", "text": "[Respuesta real — PERSONALIZAR]" } }
  ]
}
</script>
```

> **Para tu primera página real:** pásame la keyword + datos del negocio
> (precios, horarios, diferenciadores) y te entrego el kit completo ya
> redactado, sin placeholders.
