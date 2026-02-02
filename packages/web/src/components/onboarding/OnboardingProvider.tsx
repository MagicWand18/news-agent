"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { TourProvider, useTour } from "@reactour/tour";
import { trpc } from "@/lib/trpc";
import { WelcomeModal } from "./WelcomeModal";
import { tourSteps } from "./TourSteps";
import { usePathname } from "next/navigation";

type OnboardingStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

interface OnboardingContextValue {
  status: OnboardingStatus;
  isLoading: boolean;
  isTourRunning: boolean;
  startTour: () => void;
  skipOnboarding: () => void;
  resetTour: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding debe usarse dentro de OnboardingProvider");
  }
  return context;
}

interface OnboardingProviderProps {
  children: ReactNode;
}

/**
 * Componente interno que maneja la lógica del tour
 */
function OnboardingController({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { setIsOpen, isOpen, setCurrentStep } = useTour();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Query para obtener el estado de onboarding
  const { data, isLoading, refetch } = trpc.onboarding.getStatus.useQuery(undefined, {
    enabled: pathname?.startsWith("/dashboard"),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  // Mutation para actualizar el estado
  const updateStatusMutation = trpc.onboarding.updateStatus.useMutation({
    onSuccess: () => refetch(),
  });

  // Mutation para resetear
  const resetMutation = trpc.onboarding.reset.useMutation({
    onSuccess: () => {
      refetch();
      setShowWelcomeModal(true);
    },
  });

  const status: OnboardingStatus = data?.status ?? "PENDING";

  // Mostrar modal de bienvenida si el estado es PENDING y estamos en dashboard
  useEffect(() => {
    if (!isLoading && status === "PENDING" && pathname === "/dashboard") {
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, status, pathname]);

  // Detectar cuando el tour termina
  useEffect(() => {
    if (!isOpen && status === "IN_PROGRESS") {
      // El tour se cerró mientras estaba en progreso
      updateStatusMutation.mutate({ status: "COMPLETED" });
    }
  }, [isOpen, status, updateStatusMutation]);

  const startTour = useCallback(() => {
    setShowWelcomeModal(false);
    updateStatusMutation.mutate({ status: "IN_PROGRESS" });
    setTimeout(() => {
      setCurrentStep(0);
      setIsOpen(true);
    }, 300);
  }, [updateStatusMutation, setIsOpen, setCurrentStep]);

  const skipOnboarding = useCallback(() => {
    setShowWelcomeModal(false);
    updateStatusMutation.mutate({ status: "SKIPPED" });
  }, [updateStatusMutation]);

  const resetTour = useCallback(() => {
    resetMutation.mutate();
  }, [resetMutation]);

  const contextValue: OnboardingContextValue = {
    status,
    isLoading: isLoading || updateStatusMutation.isPending || resetMutation.isPending,
    isTourRunning: isOpen,
    startTour,
    skipOnboarding,
    resetTour,
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onStartTour={startTour}
        onSkip={skipOnboarding}
      />
    </OnboardingContext.Provider>
  );
}

/**
 * Convierte los pasos del formato anterior al formato de @reactour/tour
 */
const reactourSteps = tourSteps.map((step) => ({
  selector: step.target as string,
  content: (
    <div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {step.title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">{step.content}</p>
    </div>
  ),
}));

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  return (
    <TourProvider
      steps={reactourSteps}
      showBadge={true}
      showCloseButton={true}
      showDots={true}
      showNavigation={true}
      showPrevNextButtons={true}
      scrollSmooth
      padding={{ mask: 8, popover: [8, 16] }}
      styles={{
        popover: (base) => ({
          ...base,
          borderRadius: 12,
          padding: 20,
          backgroundColor: "var(--joyride-bg, #fff)",
          color: "var(--joyride-text, #1f2937)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }),
        maskArea: (base) => ({
          ...base,
          rx: 8,
        }),
        badge: (base) => ({
          ...base,
          backgroundColor: "#3b82f6",
        }),
        dot: (base, state) => ({
          ...base,
          backgroundColor: state?.current ? "#3b82f6" : "#e5e7eb",
        }),
        close: (base) => ({
          ...base,
          color: "#9ca3af",
        }),
      }}
    >
      <OnboardingController>{children}</OnboardingController>
    </TourProvider>
  );
}
