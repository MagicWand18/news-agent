/**
 * Tests para el comments worker - extracción de IDs de URL.
 * Enfocado en las funciones helper de extracción de IDs y el case YouTube.
 */
import { describe, it, expect } from "vitest";

// Extraemos la lógica de extracción para testear directamente
// ya que las funciones no están exportadas del módulo

function extractInstagramShortcode(postUrl: string): string | null {
  const match = postUrl.match(/instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

function extractTikTokVideoId(postUrl: string): string | null {
  const match = postUrl.match(/video\/(\d+)/);
  return match ? match[1] : null;
}

function extractYouTubeVideoId(postUrl: string): string | null {
  const match = postUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

describe("extractInstagramShortcode", () => {
  it("extrae shortcode de URL de post", () => {
    expect(extractInstagramShortcode("https://instagram.com/p/CxYz123AbC")).toBe("CxYz123AbC");
  });

  it("extrae shortcode de URL de reel", () => {
    expect(extractInstagramShortcode("https://instagram.com/reel/CxYz123AbC")).toBe("CxYz123AbC");
  });

  it("extrae shortcode de URL de reels", () => {
    expect(extractInstagramShortcode("https://instagram.com/reels/CxYz123AbC")).toBe("CxYz123AbC");
  });

  it("retorna null para URL inválida", () => {
    expect(extractInstagramShortcode("https://instagram.com/user/test")).toBeNull();
  });
});

describe("extractTikTokVideoId", () => {
  it("extrae ID del video de URL estándar", () => {
    expect(extractTikTokVideoId("https://tiktok.com/@user/video/7123456789012345678")).toBe("7123456789012345678");
  });

  it("retorna null para URL sin video", () => {
    expect(extractTikTokVideoId("https://tiktok.com/@user")).toBeNull();
  });
});

describe("extractYouTubeVideoId", () => {
  it("extrae ID de URL youtube.com/watch?v=", () => {
    expect(extractYouTubeVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extrae ID de URL www.youtube.com/watch?v=", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extrae ID de URL corta youtu.be/", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extrae ID con parámetros adicionales en URL", () => {
    expect(extractYouTubeVideoId("https://youtube.com/watch?v=abc123&t=120")).toBe("abc123");
  });

  it("maneja IDs con guiones y guiones bajos", () => {
    expect(extractYouTubeVideoId("https://youtube.com/watch?v=Ab-Cd_Ef12")).toBe("Ab-Cd_Ef12");
  });

  it("retorna null para URL inválida", () => {
    expect(extractYouTubeVideoId("https://youtube.com/channel/UCtest")).toBeNull();
  });

  it("retorna null para URL de playlist", () => {
    expect(extractYouTubeVideoId("https://youtube.com/playlist?list=PLtest")).toBeNull();
  });
});
