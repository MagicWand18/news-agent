"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type KeyHandler = () => void;

/**
 * Detecta si el foco esta en un elemento editable (input, textarea, etc.)
 */
function isEditableElement(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tagName = el.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") return true;
  if (el.isContentEditable) return true;
  return false;
}

/**
 * Hook para registrar un atajo de teclado global.
 * Soporta teclas simples ("?") y combinaciones con modificador ("mod+k").
 */
export function useShortcut(key: string, handler: KeyHandler, enabled = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableElement(e.target)) return;

      const modKey = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+K
      if (key === "mod+k" && modKey && e.key === "k") {
        e.preventDefault();
        handlerRef.current();
        return;
      }

      // Teclas simples (sin modificadores)
      if (!modKey && !e.altKey && e.key === key) {
        if (key === "?" && !e.shiftKey) return;
        handlerRef.current();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, enabled]);
}

/**
 * Hook para secuencias de teclas tipo "g d" (go to dashboard).
 * El buffer se limpia despues de 800ms de inactividad.
 */
export function useKeySequence(sequence: string[], handler: KeyHandler, enabled = true) {
  const bufferRef = useRef<string[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableElement(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      bufferRef.current.push(e.key.toLowerCase());

      // Limpiar buffer despues de 800ms
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        bufferRef.current = [];
      }, 800);

      // Verificar si el buffer coincide con la secuencia
      if (bufferRef.current.length === sequence.length) {
        const matches = sequence.every((k, i) => bufferRef.current[i] === k);
        if (matches) {
          handlerRef.current();
        }
        bufferRef.current = [];
      } else if (bufferRef.current.length > sequence.length) {
        bufferRef.current = [e.key.toLowerCase()];
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sequence, enabled]);
}

/**
 * Hook con todos los atajos globales de navegacion.
 * Registra Cmd+K para command palette, ? para help, y secuencias g+X para navegacion.
 */
export function useGlobalShortcuts(callbacks: {
  onOpenCommandPalette?: () => void;
  onOpenHelp?: () => void;
}) {
  const router = useRouter();

  // Cmd+K -> Command Palette
  useShortcut("mod+k", () => callbacks.onOpenCommandPalette?.());

  // ? -> Dialogo de atajos
  useShortcut("?", () => callbacks.onOpenHelp?.());

  // Secuencias de navegacion
  useKeySequence(["g", "d"], () => router.push("/dashboard"));
  useKeySequence(["g", "m"], () => router.push("/dashboard/mentions"));
  useKeySequence(["g", "s"], () => router.push("/dashboard/social-mentions"));
  useKeySequence(["g", "c"], () => router.push("/dashboard/clients"));
  useKeySequence(["g", "k"], () => router.push("/dashboard/crisis"));
  useKeySequence(["g", "i"], () => router.push("/dashboard/intelligence"));
}
