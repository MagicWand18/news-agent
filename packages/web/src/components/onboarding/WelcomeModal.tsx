"use client";

import { useEffect, useCallback } from "react";
import { X, Sparkles, ArrowRight, SkipForward } from "lucide-react";

interface WelcomeModalProps {
  isOpen: boolean;
  onStartTour: () => void;
  onSkip: () => void;
}

export function WelcomeModal({ isOpen, onStartTour, onSkip }: WelcomeModalProps) {
  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Cerrar con Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onSkip();
      }
    },
    [onSkip]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Overlay con blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onSkip}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative z-10 mx-4 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-2xl dark:border-gray-700 dark:bg-gray-800">
          {/* Botón cerrar */}
          <button
            onClick={onSkip}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Icono decorativo */}
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/25">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
          </div>

          {/* Contenido */}
          <div className="text-center">
            <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
              ¡Bienvenido a MediaBot!
            </h2>
            <p className="mb-6 text-gray-600 dark:text-gray-400">
              Te guiaremos por las principales funcionalidades de la plataforma para que puedas
              aprovechar al máximo tu monitoreo de medios.
            </p>
          </div>

          {/* Botones */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onStartTour}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              Comenzar tour
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              onClick={onSkip}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
            >
              <SkipForward className="h-4 w-4" />
              Saltar por ahora
            </button>
          </div>

          {/* Nota */}
          <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-500">
            Siempre puedes repetir el tour desde el menú lateral
          </p>
        </div>
      </div>
    </div>
  );
}
