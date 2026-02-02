"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { TourProvider, useTour } from "@reactour/tour";
import { trpc } from "@/lib/trpc";
import { WelcomeModal } from "./WelcomeModal";
import { tourSteps, getStepRoute, getStepAction } from "./TourSteps";
import { usePathname, useRouter } from "next/navigation";

type OnboardingStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

// Keys para sessionStorage
const STORAGE_KEYS = {
  IS_NAVIGATING: "mediabot_tour_navigating",
  PENDING_STEP: "mediabot_tour_pending_step",
  LAST_PATHNAME: "mediabot_tour_last_pathname",
};

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
 * Helpers para manejar el estado de navegación en sessionStorage
 */
function setNavigationState(pendingStep: number, targetPath: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEYS.IS_NAVIGATING, "true");
  sessionStorage.setItem(STORAGE_KEYS.PENDING_STEP, String(pendingStep));
  sessionStorage.setItem(STORAGE_KEYS.LAST_PATHNAME, targetPath);
}

function clearNavigationState() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEYS.IS_NAVIGATING);
  sessionStorage.removeItem(STORAGE_KEYS.PENDING_STEP);
  sessionStorage.removeItem(STORAGE_KEYS.LAST_PATHNAME);
}

function getNavigationState(): { isNavigating: boolean; pendingStep: number | null; targetPath: string | null } {
  if (typeof window === "undefined") {
    return { isNavigating: false, pendingStep: null, targetPath: null };
  }
  const isNavigating = sessionStorage.getItem(STORAGE_KEYS.IS_NAVIGATING) === "true";
  const stepStr = sessionStorage.getItem(STORAGE_KEYS.PENDING_STEP);
  const targetPath = sessionStorage.getItem(STORAGE_KEYS.LAST_PATHNAME);
  return {
    isNavigating,
    pendingStep: stepStr ? parseInt(stepStr, 10) : null,
    targetPath,
  };
}

/**
 * Componente interno que maneja la lógica del tour con navegación
 */
function OnboardingController({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setIsOpen, isOpen, setCurrentStep, currentStep } = useTour();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingNavigationRef = useRef(false);

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

  // Efecto para reanudar tour después de navegación
  useEffect(() => {
    // Prevenir procesamiento múltiple
    if (isProcessingNavigationRef.current) return;

    const navState = getNavigationState();

    // Solo procesar si estamos navegando y llegamos a la ruta correcta
    if (navState.isNavigating && navState.pendingStep !== null && navState.targetPath === pathname) {
      isProcessingNavigationRef.current = true;

      const resumeTour = () => {
        const step = tourSteps[navState.pendingStep!];
        if (!step) {
          clearNavigationState();
          isProcessingNavigationRef.current = false;
          return;
        }

        const element = document.querySelector(step.target);

        if (element) {
          const action = getStepAction(navState.pendingStep!);
          if (action === "scrollToElement") {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }

          // Limpiar estado ANTES de reabrir el tour
          clearNavigationState();

          setTimeout(() => {
            setCurrentStep(navState.pendingStep!);
            setIsOpen(true);
            isProcessingNavigationRef.current = false;
          }, 400);
        } else {
          // Elemento no encontrado, reintentar
          setTimeout(resumeTour, 150);
        }
      };

      // Dar tiempo a que el DOM se renderice
      setTimeout(resumeTour, 300);
    }
  }, [pathname, setCurrentStep, setIsOpen]);

  // Mostrar modal de bienvenida si el estado es PENDING y estamos en dashboard
  useEffect(() => {
    const navState = getNavigationState();
    if (!isLoading && status === "PENDING" && pathname === "/dashboard" && !navState.isNavigating) {
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, status, pathname]);

  // Detectar cuando el tour termina
  useEffect(() => {
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }

    // Solo marcar como completado si:
    // 1. El tour está cerrado
    // 2. El status es IN_PROGRESS
    // 3. NO estamos en proceso de navegación
    if (!isOpen && status === "IN_PROGRESS") {
      completionTimeoutRef.current = setTimeout(() => {
        const navState = getNavigationState();
        if (!navState.isNavigating) {
          updateStatusMutation.mutate({ status: "COMPLETED" });
        }
      }, 2000); // 2 segundos de delay
    }

    return () => {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }
    };
  }, [isOpen, status, updateStatusMutation]);

  // Manejar navegación cuando cambia el paso
  useEffect(() => {
    // No hacer nada si el tour no está abierto
    if (!isOpen) return;

    const navState = getNavigationState();
    // No hacer nada si ya estamos navegando
    if (navState.isNavigating) return;

    const targetRoute = getStepRoute(currentStep);

    // Si necesitamos navegar a otra página
    if (targetRoute && pathname !== targetRoute) {
      // Guardar estado ANTES de cerrar el tour
      setNavigationState(currentStep, targetRoute);

      // Cerrar tour y navegar
      setIsOpen(false);
      router.push(targetRoute);
    } else {
      // Estamos en la ruta correcta, solo scroll si necesario
      const action = getStepAction(currentStep);
      const step = tourSteps[currentStep];

      if (action === "scrollToElement" && step) {
        const element = document.querySelector(step.target);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  }, [currentStep, isOpen, pathname, router, setIsOpen]);

  const startTour = useCallback(() => {
    setShowWelcomeModal(false);
    clearNavigationState();
    updateStatusMutation.mutate({ status: "IN_PROGRESS" });

    if (pathname !== "/dashboard") {
      setNavigationState(0, "/dashboard");
      router.push("/dashboard");
    } else {
      setTimeout(() => {
        setCurrentStep(0);
        setIsOpen(true);
      }, 300);
    }
  }, [updateStatusMutation, pathname, router, setCurrentStep, setIsOpen]);

  const skipOnboarding = useCallback(() => {
    setShowWelcomeModal(false);
    clearNavigationState();
    updateStatusMutation.mutate({ status: "SKIPPED" });
  }, [updateStatusMutation]);

  const resetTour = useCallback(() => {
    clearNavigationState();
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
 * Convierte los pasos al formato de @reactour/tour
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
      onClickMask={() => {
        // No cerrar al hacer clic en el mask
      }}
      styles={{
        popover: (base) => ({
          ...base,
          borderRadius: 12,
          padding: 20,
          backgroundColor: "var(--joyride-bg, #fff)",
          color: "var(--joyride-text, #1f2937)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          zIndex: 99999,
          maxWidth: 320,
        }),
        maskWrapper: (base) => ({
          ...base,
          zIndex: 99998,
        }),
        maskArea: (base) => ({
          ...base,
          rx: 8,
        }),
        highlightedArea: (base) => ({
          ...base,
          stroke: "#3b82f6",
          strokeWidth: 3,
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
