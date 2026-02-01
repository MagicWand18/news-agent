/**
 * Tests para utilidades de URL.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeUrl,
  isVertexRedirectUrl,
  decodeHtmlEntities,
  isSoft404,
  extractTitle,
  deduplicateUrls,
  extractDomain,
} from "../url-utils";

describe("normalizeUrl", () => {
  it("convierte HTTP a HTTPS", () => {
    expect(normalizeUrl("http://example.com/article")).toBe(
      "https://example.com/article"
    );
  });

  it("remueve www del hostname", () => {
    expect(normalizeUrl("https://www.example.com/article")).toBe(
      "https://example.com/article"
    );
  });

  it("remueve trailing slash", () => {
    expect(normalizeUrl("https://example.com/article/")).toBe(
      "https://example.com/article"
    );
  });

  it("preserva trailing slash en dominio raíz", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("remueve fragmentos (#)", () => {
    expect(normalizeUrl("https://example.com/article#section")).toBe(
      "https://example.com/article"
    );
  });

  it("remueve parámetros de tracking utm_*", () => {
    expect(
      normalizeUrl(
        "https://example.com/article?id=123&utm_source=google&utm_medium=cpc"
      )
    ).toBe("https://example.com/article?id=123");
  });

  it("remueve fbclid", () => {
    expect(
      normalizeUrl("https://example.com/article?fbclid=abc123")
    ).toBe("https://example.com/article");
  });

  it("remueve gclid", () => {
    expect(
      normalizeUrl("https://example.com/article?gclid=xyz789")
    ).toBe("https://example.com/article");
  });

  it("preserva parámetros no tracking", () => {
    expect(
      normalizeUrl("https://example.com/article?page=2&sort=date")
    ).toBe("https://example.com/article?page=2&sort=date");
  });

  it("hace lowercase al hostname", () => {
    expect(normalizeUrl("https://EXAMPLE.COM/Article")).toBe(
      "https://example.com/Article"
    );
  });

  it("maneja URLs inválidas retornando el original", () => {
    expect(normalizeUrl("not-a-url")).toBe("not-a-url");
  });

  it("normaliza URLs de milenio.com correctamente", () => {
    const url =
      "https://www.milenio.com/negocios/noticia-ejemplo?utm_source=twitter&fbclid=abc#comentarios";
    expect(normalizeUrl(url)).toBe(
      "https://milenio.com/negocios/noticia-ejemplo"
    );
  });
});

describe("isVertexRedirectUrl", () => {
  it("detecta URLs de Vertex redirect", () => {
    expect(
      isVertexRedirectUrl(
        "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc123"
      )
    ).toBe(true);
  });

  it("retorna false para URLs normales", () => {
    expect(isVertexRedirectUrl("https://example.com/article")).toBe(false);
  });
});

describe("decodeHtmlEntities", () => {
  it("decodifica &amp;", () => {
    expect(decodeHtmlEntities("Tom &amp; Jerry")).toBe("Tom & Jerry");
  });

  it("decodifica &lt; y &gt;", () => {
    expect(decodeHtmlEntities("5 &lt; 10 &gt; 2")).toBe("5 < 10 > 2");
  });

  it("decodifica &quot;", () => {
    expect(decodeHtmlEntities('Dijo &quot;hola&quot;')).toBe('Dijo "hola"');
  });

  it("decodifica &#39; (apóstrofe numérico)", () => {
    expect(decodeHtmlEntities("It&#39;s working")).toBe("It's working");
  });

  it("decodifica &nbsp;", () => {
    expect(decodeHtmlEntities("Espacio&nbsp;duro")).toBe("Espacio duro");
  });

  it("decodifica entidades numéricas decimales", () => {
    expect(decodeHtmlEntities("Copyright &#169; 2024")).toBe(
      "Copyright © 2024"
    );
  });

  it("decodifica entidades numéricas hexadecimales", () => {
    expect(decodeHtmlEntities("Heart &#x2764;")).toBe("Heart ❤");
  });

  it("maneja múltiples entidades juntas", () => {
    expect(
      decodeHtmlEntities("&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;")
    ).toBe('<script>alert("XSS")</script>');
  });
});

describe("isSoft404", () => {
  it("detecta 'página no encontrada' en español", () => {
    expect(
      isSoft404("<html><body>Página no encontrada</body></html>", 200)
    ).toBe(true);
  });

  it("detecta 'page not found' en inglés", () => {
    expect(
      isSoft404("<html><body>Page Not Found</body></html>", 200)
    ).toBe(true);
  });

  it("detecta 'error 404' en el contenido", () => {
    expect(
      isSoft404("<html><body>Error 404 - Lo sentimos</body></html>", 200)
    ).toBe(true);
  });

  it("detecta títulos con 404", () => {
    expect(
      isSoft404("<html><title>404 - No encontrado</title><body></body></html>", 200)
    ).toBe(true);
  });

  it("detecta 'contenido no disponible'", () => {
    expect(
      isSoft404("<html><body>El contenido no disponible</body></html>", 200)
    ).toBe(true);
  });

  it("retorna false para contenido normal", () => {
    expect(
      isSoft404(
        "<html><title>Noticia importante</title><body>Contenido del artículo...</body></html>",
        200
      )
    ).toBe(false);
  });

  it("retorna false si status code no es 200", () => {
    expect(
      isSoft404("<html><body>Page not found</body></html>", 404)
    ).toBe(false);
  });
});

describe("extractTitle", () => {
  it("prioriza og:title sobre title", () => {
    const html = `
      <html>
        <head>
          <title>Título básico | Sitio</title>
          <meta property="og:title" content="Título Open Graph Mejor">
        </head>
        <body></body>
      </html>
    `;
    const result = extractTitle(html, "example.com");
    expect(result.title).toBe("Título Open Graph Mejor");
    expect(result.source).toBe("og:title");
    expect(result.isGeneric).toBe(false);
  });

  it("usa title si no hay og:title", () => {
    const html = `
      <html>
        <head>
          <title>Noticia importante - El Universal</title>
        </head>
        <body></body>
      </html>
    `;
    const result = extractTitle(html, "eluniversal.com.mx");
    expect(result.title).toBe("Noticia importante");
    expect(result.source).toBe("title");
  });

  it("limpia sufijos de sitios conocidos", () => {
    const html = `<html><head><title>Empresa anuncia expansión | El Financiero</title></head></html>`;
    const result = extractTitle(html, "elfinanciero.com.mx");
    expect(result.title).toBe("Empresa anuncia expansión");
  });

  it("usa h1 si no hay title válido", () => {
    const html = `
      <html>
        <head><title>404</title></head>
        <body><h1>Noticia del día en México</h1></body>
      </html>
    `;
    const result = extractTitle(html, "example.com");
    expect(result.title).toBe("Noticia del día en México");
    expect(result.source).toBe("h1");
  });

  it("usa meta description como último recurso", () => {
    const html = `
      <html>
        <head>
          <title>N/A</title>
          <meta name="description" content="Descripción detallada del contenido de la página que puede servir como título.">
        </head>
        <body></body>
      </html>
    `;
    const result = extractTitle(html, "example.com");
    expect(result.title).toBe(
      "Descripción detallada del contenido de la página que puede servir como título."
    );
    expect(result.source).toBe("meta-description");
  });

  it("retorna fallback cuando no hay contenido útil", () => {
    const html = `<html><head></head><body></body></html>`;
    const result = extractTitle(html, "milenio.com");
    expect(result.title).toBe("Artículo de milenio.com");
    expect(result.source).toBe("fallback");
    expect(result.isGeneric).toBe(true);
  });

  it("decodifica entidades HTML en títulos", () => {
    const html = `<html><head><title>Tom &amp; Jerry: La Película</title></head></html>`;
    const result = extractTitle(html, "example.com");
    expect(result.title).toBe("Tom & Jerry: La Película");
  });

  it("maneja og:title con content antes de property", () => {
    const html = `
      <html>
        <head>
          <meta content="Título OG invertido" property="og:title">
        </head>
      </html>
    `;
    const result = extractTitle(html, "example.com");
    expect(result.title).toBe("Título OG invertido");
    expect(result.source).toBe("og:title");
  });
});

describe("deduplicateUrls", () => {
  it("elimina duplicados exactos", () => {
    const items = [
      { url: "https://example.com/a", title: "A" },
      { url: "https://example.com/b", title: "B" },
      { url: "https://example.com/a", title: "A duplicate" },
    ];
    const result = deduplicateUrls(items, (i) => i.url);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("A");
    expect(result[1].title).toBe("B");
  });

  it("elimina duplicados con diferentes variaciones de URL", () => {
    const items = [
      { url: "https://www.example.com/article", title: "Con www" },
      { url: "http://example.com/article", title: "Sin www y http" },
      { url: "https://example.com/article/", title: "Con trailing slash" },
      { url: "https://example.com/article?utm_source=google", title: "Con tracking" },
    ];
    const result = deduplicateUrls(items, (i) => i.url);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Con www"); // Preserva el primero
  });

  it("preserva el orden original (primer elemento)", () => {
    const items = [
      { url: "https://example.com/c", id: 3 },
      { url: "https://example.com/a", id: 1 },
      { url: "https://www.example.com/a", id: 2 }, // Duplicado
      { url: "https://example.com/b", id: 4 },
    ];
    const result = deduplicateUrls(items, (i) => i.url);
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.id)).toEqual([3, 1, 4]);
  });

  it("maneja lista vacía", () => {
    const result = deduplicateUrls([], (i: { url: string }) => i.url);
    expect(result).toHaveLength(0);
  });

  it("maneja lista sin duplicados", () => {
    const items = [
      { url: "https://a.com", title: "A" },
      { url: "https://b.com", title: "B" },
      { url: "https://c.com", title: "C" },
    ];
    const result = deduplicateUrls(items, (i) => i.url);
    expect(result).toHaveLength(3);
  });
});

describe("extractDomain", () => {
  it("extrae dominio sin www", () => {
    expect(extractDomain("https://www.example.com/path")).toBe("example.com");
  });

  it("maneja subdominios", () => {
    expect(extractDomain("https://news.example.com/article")).toBe(
      "news.example.com"
    );
  });

  it("retorna 'Web' para URLs inválidas", () => {
    expect(extractDomain("not-a-url")).toBe("Web");
  });
});
