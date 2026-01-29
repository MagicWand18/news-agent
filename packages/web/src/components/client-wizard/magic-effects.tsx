"use client";

import { useEffect, useState } from "react";

/**
 * Efecto de partículas brillantes (sparkles).
 */
export function SparkleEffect({ count = 20 }: { count?: number }) {
  const [sparkles, setSparkles] = useState<
    Array<{ id: number; x: number; y: number; delay: number; size: number }>
  >([]);

  useEffect(() => {
    const newSparkles = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
      size: 4 + Math.random() * 8,
    }));
    setSparkles(newSparkles);
  }, [count]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {sparkles.map((sparkle) => (
        <div
          key={sparkle.id}
          className="absolute animate-sparkle"
          style={{
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
            width: sparkle.size,
            height: sparkle.size,
            animationDelay: `${sparkle.delay}s`,
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="text-yellow-400">
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
          </svg>
        </div>
      ))}
      <style jsx>{`
        @keyframes sparkle {
          0%,
          100% {
            opacity: 0;
            transform: scale(0) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: scale(1) rotate(180deg);
          }
        }
        .animate-sparkle {
          animation: sparkle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

/**
 * Barra de progreso con efecto shimmer.
 */
export function MagicProgress({
  progress,
  label,
}: {
  progress: number;
  label?: string;
}) {
  return (
    <div className="w-full">
      {label && (
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-gray-600">{label}</span>
          <span className="font-medium text-brand-600">{Math.round(progress)}%</span>
        </div>
      )}
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="relative h-full rounded-full bg-gradient-to-r from-brand-500 via-brand-400 to-brand-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </div>
      </div>
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}

/**
 * Efecto de confetti para celebrar.
 */
export function ConfettiEffect({ active = false }: { active?: boolean }) {
  const [particles, setParticles] = useState<
    Array<{
      id: number;
      x: number;
      color: string;
      delay: number;
      rotation: number;
      size: number;
    }>
  >([]);

  useEffect(() => {
    if (active) {
      const colors = [
        "#FFD700",
        "#FF6B6B",
        "#4ECDC4",
        "#45B7D1",
        "#96CEB4",
        "#FFEAA7",
        "#DDA0DD",
        "#98D8C8",
      ];
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
        rotation: Math.random() * 360,
        size: 8 + Math.random() * 8,
      }));
      setParticles(newParticles);

      // Limpiar después de la animación
      const timer = setTimeout(() => setParticles([]), 4000);
      return () => clearTimeout(timer);
    }
  }, [active]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti"
          style={{
            left: `${p.x}%`,
            top: "-20px",
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

/**
 * Efecto de pulso con glow.
 */
export function PulseGlow({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="animate-pulse-glow absolute inset-0 rounded-xl bg-brand-500/20" />
      <div className="relative">{children}</div>
      <style jsx>{`
        @keyframes pulse-glow {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.02);
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

/**
 * Indicador de carga con animación de búsqueda.
 */
export function SearchingAnimation({ text = "Buscando..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-16 w-16">
        {/* Círculos concéntricos animados */}
        <div className="absolute inset-0 animate-ping rounded-full bg-brand-400/30" />
        <div
          className="absolute inset-2 animate-ping rounded-full bg-brand-500/40"
          style={{ animationDelay: "0.3s" }}
        />
        <div
          className="absolute inset-4 animate-ping rounded-full bg-brand-600/50"
          style={{ animationDelay: "0.6s" }}
        />
        {/* Ícono central */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="h-8 w-8 animate-spin text-brand-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      </div>
      <p className="animate-pulse text-lg font-medium text-gray-600">{text}</p>
    </div>
  );
}

/**
 * Tarjeta de noticia con animación de entrada.
 */
export function NewsCardAnimated({
  title,
  source,
  date,
  index = 0,
  selected = false,
  onSelect,
}: {
  title: string;
  source: string;
  date?: string;
  index?: number;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div
      className={`
        cursor-pointer rounded-lg border-2 p-4 transition-all duration-300
        ${selected ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-brand-300"}
        animate-slide-up
      `}
      style={{ animationDelay: `${index * 100}ms` }}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div
          className={`
            flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors
            ${selected ? "border-brand-500 bg-brand-500" : "border-gray-300"}
          `}
        >
          {selected && (
            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 line-clamp-2">{title}</p>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <span>{source}</span>
            {date && (
              <>
                <span>•</span>
                <span>{date}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes slide-up {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}

/**
 * Chip de keyword editable con tipo.
 */
export function KeywordChip({
  word,
  type,
  selected = true,
  onToggle,
  onRemove,
}: {
  word: string;
  type: string;
  selected?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
}) {
  const typeColors: Record<string, string> = {
    NAME: "bg-blue-100 text-blue-700 border-blue-200",
    BRAND: "bg-purple-100 text-purple-700 border-purple-200",
    COMPETITOR: "bg-orange-100 text-orange-700 border-orange-200",
    TOPIC: "bg-green-100 text-green-700 border-green-200",
    ALIAS: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all
        ${selected ? typeColors[type] || typeColors.TOPIC : "bg-gray-50 text-gray-400 border-gray-200"}
        ${onToggle ? "cursor-pointer hover:opacity-80" : ""}
      `}
      onClick={onToggle}
    >
      <span className="font-medium">{word}</span>
      <span className="text-xs opacity-70">[{type}]</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 rounded-full p-0.5 hover:bg-black/10"
        >
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Stepper visual para el wizard.
 */
export function WizardStepper({
  steps,
  currentStep,
}: {
  steps: string[];
  currentStep: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`
                flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all
                ${
                  index < currentStep
                    ? "bg-brand-600 text-white"
                    : index === currentStep
                    ? "bg-brand-100 text-brand-600 ring-2 ring-brand-600"
                    : "bg-gray-100 text-gray-400"
                }
              `}
            >
              {index < currentStep ? (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                index + 1
              )}
            </div>
            <span
              className={`mt-1 text-xs ${
                index <= currentStep ? "text-brand-600 font-medium" : "text-gray-400"
              }`}
            >
              {step}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`mx-2 h-0.5 w-12 ${
                index < currentStep ? "bg-brand-600" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
