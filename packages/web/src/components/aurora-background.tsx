"use client";

import { cn } from "@/lib/cn";

interface AuroraBackgroundProps {
  children: React.ReactNode;
  className?: string;
  /** Variante de color para el efecto aurora */
  variant?: "default" | "brand" | "purple";
}

/**
 * Componente de fondo con efecto de aurora boreal animada
 * Respeta la preferencia de movimiento reducido del usuario
 */
export function AuroraBackground({
  children,
  className,
  variant = "brand",
}: AuroraBackgroundProps) {
  return (
    <div className={cn("relative min-h-screen overflow-hidden", className)}>
      {/* Capa de aurora animada */}
      <div
        className={cn(
          "aurora-bg absolute inset-0 -z-10",
          variant === "brand" && "aurora-brand",
          variant === "purple" && "aurora-purple",
          variant === "default" && "aurora-default"
        )}
        aria-hidden="true"
      />
      {/* Capa de gradiente base */}
      <div
        className={cn(
          "absolute inset-0 -z-10",
          variant === "brand" && "bg-gradient-to-br from-brand-900 via-brand-800 to-blue-900",
          variant === "purple" && "bg-gradient-to-br from-purple-900 via-indigo-800 to-blue-900",
          variant === "default" && "bg-gradient-to-br from-gray-900 via-gray-800 to-slate-900"
        )}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
