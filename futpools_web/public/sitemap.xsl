<?xml version="1.0" encoding="UTF-8"?>
<!--
  sitemap.xsl — human-friendly rendering for /sitemap.xml.
  Referenced via <?xml-stylesheet?> in the sitemap. Browsers apply it to
  show a styled table; crawlers ignore it and parse the raw XML. Must be
  same-origin as the sitemap (served from futpools.com/sitemap.xsl).
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex"/>
        <title>FutPools — Sitemap</title>
        <style>
          :root { --bg:#07090d; --bg2:#0b0f14; --surface:#11161e; --stroke:#222a35;
                  --text:#f3f6fb; --dim:#9aa6b6; --muted:#6b7686; --primary:#21e28c; --accent:#36e9ff; }
          * { box-sizing:border-box; }
          body { margin:0; background:var(--bg); color:var(--text);
                 font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                 padding:32px 20px; }
          .wrap { max-width:1100px; margin:0 auto; }
          h1 { font-size:22px; font-weight:800; letter-spacing:1px; margin:0 0 4px; }
          h1 .fp { color:var(--primary); }
          .meta { color:var(--dim); font-size:13px; margin-bottom:20px; }
          .meta b { color:var(--accent); }
          .note { color:var(--muted); font-size:12px; margin:18px 0 22px; line-height:1.5;
                  border-left:2px solid var(--stroke); padding-left:12px; }
          table { width:100%; border-collapse:collapse; background:var(--surface);
                  border:1px solid var(--stroke); border-radius:10px; overflow:hidden; }
          th { text-align:left; font-size:11px; letter-spacing:1px; text-transform:uppercase;
               color:var(--muted); padding:11px 14px; background:var(--bg2);
               border-bottom:1px solid var(--stroke); }
          td { padding:11px 14px; font-size:13px; border-bottom:1px solid var(--stroke);
               vertical-align:top; }
          tr:last-child td { border-bottom:none; }
          tr:hover td { background:rgba(33,226,140,0.04); }
          a { color:var(--primary); text-decoration:none; word-break:break-all; }
          a:hover { text-decoration:underline; }
          .num { font-variant-numeric:tabular-nums; color:var(--dim); white-space:nowrap; }
          .pri { color:var(--accent); font-weight:700; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1><span class="fp">Fut</span>Pools — Sitemap</h1>
          <div class="meta"><b><xsl:value-of select="count(s:urlset/s:url)"/></b> URLs · generated for search engines</div>
          <div class="note">This is an XML sitemap, meant for search engines (Google, Bing). The styled table you see is just for humans — crawlers read the raw XML.</div>
          <table>
            <tr>
              <th>URL</th>
              <th>Last modified</th>
              <th>Change freq</th>
              <th>Priority</th>
            </tr>
            <xsl:for-each select="s:urlset/s:url">
              <tr>
                <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                <td class="num"><xsl:value-of select="s:lastmod"/></td>
                <td class="num"><xsl:value-of select="s:changefreq"/></td>
                <td class="pri"><xsl:value-of select="s:priority"/></td>
              </tr>
            </xsl:for-each>
          </table>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
