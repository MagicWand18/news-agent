"use client";

import { HelpCircle } from "lucide-react";
import { useOnboarding } from "./OnboardingProvider";
import { cn } from "@/lib/cn";

interface TourButtonProps {
  variant?: "icon" | "full";
  className?: string;
}

/**
 * Botón para reiniciar y ver nuevamente el tour de onboarding
 */
export function TourButton({ variant = "full", className }: TourButtonProps) {
  const { resetTour, isLoading } = useOnboarding();

  if (variant === "icon") {
    return (
      <button
        onClick={resetTour}
        disabled={isLoading}
        className={cn(
          "flex items-center justify-center rounded-lg p-2 text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50",
          className
        )}
        aria-label="Ver tutorial"
        title="Ver tutorial"
      >
        <HelpCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      onClick={resetTour}
      disabled={isLoading}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50",
        className
      )}
    >
      <HelpCircle className="h-5 w-5" />
      Ver tutorial
    </button>
  );
}
