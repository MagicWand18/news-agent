import { describe, it, expect } from "vitest";
import { isGenericKeyword } from "../keyword-stopwords.js";

describe("isGenericKeyword", () => {
  describe("rechaza palabras cortas (<3 chars)", () => {
    it("rechaza strings vacíos", () => {
      expect(isGenericKeyword("")).toBe(true);
    });

    it("rechaza 1-2 caracteres", () => {
      expect(isGenericKeyword("ab")).toBe(true);
      expect(isGenericKeyword("a")).toBe(true);
    });
  });

  describe("rechaza stopwords geográficos", () => {
    it("rechaza ciudades/estados solos", () => {
      expect(isGenericKeyword("monterrey")).toBe(true);
      expect(isGenericKeyword("Monterrey")).toBe(true);
      expect(isGenericKeyword("CDMX")).toBe(true);
      expect(isGenericKeyword("guadalajara")).toBe(true);
      expect(isGenericKeyword("mexico")).toBe(true);
      expect(isGenericKeyword("México")).toBe(true);
      expect(isGenericKeyword("nuevo leon")).toBe(true);
      expect(isGenericKeyword("Nuevo León")).toBe(true);
    });
  });

  describe("rechaza stopwords políticos", () => {
    it("rechaza términos políticos genéricos", () => {
      expect(isGenericKeyword("gobierno")).toBe(true);
      expect(isGenericKeyword("elecciones")).toBe(true);
      expect(isGenericKeyword("congreso")).toBe(true);
      expect(isGenericKeyword("presidente")).toBe(true);
      expect(isGenericKeyword("política")).toBe(true);
      expect(isGenericKeyword("politica")).toBe(true);
    });
  });

  describe("rechaza stopwords de industria", () => {
    it("rechaza términos genéricos de industria", () => {
      expect(isGenericKeyword("economía")).toBe(true);
      expect(isGenericKeyword("economia")).toBe(true);
      expect(isGenericKeyword("mercado")).toBe(true);
      expect(isGenericKeyword("tecnología")).toBe(true);
      expect(isGenericKeyword("seguridad")).toBe(true);
      expect(isGenericKeyword("salud")).toBe(true);
    });
  });

  describe("rechaza stopwords conectores", () => {
    it("rechaza palabras genéricas de noticias", () => {
      expect(isGenericKeyword("noticias")).toBe(true);
      expect(isGenericKeyword("actualidad")).toBe(true);
      expect(isGenericKeyword("nacional")).toBe(true);
      expect(isGenericKeyword("internacional")).toBe(true);
    });
  });

  describe("acepta keywords específicos", () => {
    it("acepta nombres de personas", () => {
      expect(isGenericKeyword("Samuel García")).toBe(false);
      expect(isGenericKeyword("Claudia Sheinbaum")).toBe(false);
      expect(isGenericKeyword("AMLO")).toBe(false);
    });

    it("acepta cargos específicos", () => {
      expect(isGenericKeyword("gobernador de Nuevo León")).toBe(false);
      expect(isGenericKeyword("alcalde de Apodaca")).toBe(false);
    });

    it("acepta nombres de empresas", () => {
      expect(isGenericKeyword("PEMEX")).toBe(false);
      expect(isGenericKeyword("Grupo Alfa")).toBe(false);
      expect(isGenericKeyword("Cementos Mexicanos")).toBe(false);
    });

    it("acepta proyectos específicos", () => {
      expect(isGenericKeyword("Tren Maya")).toBe(false);
      expect(isGenericKeyword("Dos Bocas")).toBe(false);
      expect(isGenericKeyword("Plan Nuevo León")).toBe(false);
    });

    it("acepta marcas", () => {
      expect(isGenericKeyword("Coca-Cola FEMSA")).toBe(false);
      expect(isGenericKeyword("Bimbo")).toBe(false);
    });
  });

  describe("case insensitive", () => {
    it("funciona sin importar mayúsculas/minúsculas", () => {
      expect(isGenericKeyword("GOBIERNO")).toBe(true);
      expect(isGenericKeyword("Gobierno")).toBe(true);
      expect(isGenericKeyword("gobierno")).toBe(true);
    });

    it("maneja espacios al inicio/final", () => {
      expect(isGenericKeyword("  gobierno  ")).toBe(true);
      expect(isGenericKeyword(" PEMEX ")).toBe(false);
    });
  });
});
