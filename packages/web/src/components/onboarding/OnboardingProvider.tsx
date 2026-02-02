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

interface OnboardingContextValue {
  status: OnboardingStatus;
  isLoading: boolean;
  isTourRunning: boolean;
  isNavigating: boolean;
  startTour: () => void;
  skipOnboarding: () => void;
  resetTour: () => void;
  setIsNavigating: (value: boolean) => void;
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
 * Componente interno que maneja la lógica del tour con navegación
 */
function OnboardingController({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setIsOpen, isOpen, setCurrentStep, currentStep } = useTour();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Detectar cuando el tour termina (con delay para evitar falsos positivos durante navegación)
  useEffect(() => {
    // Limpiar timeout previo
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }

    if (!isOpen && status === "IN_PROGRESS") {
      // Esperar un momento para verificar si realmente se cerró o si estamos navegando
      completionTimeoutRef.current = setTimeout(() => {
        // Verificar de nuevo si el tour sigue cerrado y no estamos navegando
        if (!isNavigating) {
          updateStatusMutation.mutate({ status: "COMPLETED" });
        }
      }, 1000); // 1 segundo de delay
    }

    return () => {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }
    };
  }, [isOpen, status, isNavigating, updateStatusMutation]);

  const startTour = useCallback(() => {
    setShowWelcomeModal(false);
    updateStatusMutation.mutate({ status: "IN_PROGRESS" });

    // Asegurar que estamos en /dashboard y empezar
    if (pathname !== "/dashboard") {
      setIsNavigating(true);
      router.push("/dashboard");
      // El tour se abrirá cuando la página cargue
      setTimeout(() => {
        setIsNavigating(false);
        setCurrentStep(0);
        setIsOpen(true);
      }, 500);
    } else {
      setTimeout(() => {
        setCurrentStep(0);
        setIsOpen(true);
      }, 300);
    }
  }, [updateStatusMutation, pathname, router, setCurrentStep, setIsOpen]);

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
    isNavigating,
    startTour,
    skipOnboarding,
    resetTour,
    setIsNavigating,
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

/**
 * Componente wrapper que maneja la navegación entre pasos
 */
function TourNavigationHandler({ children }: { children: ReactNode }) {
  const { currentStep, setIsOpen, isOpen } = useTour();
  const { setIsNavigating } = useOnboarding();
  const router = useRouter();
  const pathname = usePathname();
  const prevStepRef = useRef(currentStep);
  const localNavigatingRef = useRef(false);

  // Manejar cambio de paso con navegación
  useEffect(() => {
    if (!isOpen || localNavigatingRef.current) return;

    // Solo actuar si el paso cambió
    if (prevStepRef.current === currentStep) return;
    prevStepRef.current = currentStep;

    const targetRoute = getStepRoute(currentStep);

    if (targetRoute && pathname !== targetRoute) {
      // Necesitamos navegar a otra página
      localNavigatingRef.current = true;
      setIsNavigating(true);
      setIsOpen(false);

      router.push(targetRoute);

      // Esperar navegación y reabrir tour
      const waitForNavigation = () => {
        const step = tourSteps[currentStep];
        const element = step ? document.querySelector(step.target) : null;

        if (element) {
          // Elemento encontrado, ejecutar acción y mostrar paso
          const action = getStepAction(currentStep);
          if (action === "scrollToElement") {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }

          setTimeout(() => {
            localNavigatingRef.current = false;
            setIsNavigating(false);
            setIsOpen(true);
          }, 300);
        } else {
          // Seguir esperando
          setTimeout(waitForNavigation, 100);
        }
      };

      setTimeout(waitForNavigation, 300);
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
  }, [currentStep, isOpen, pathname, router, setIsOpen, setIsNavigating]);

  return <>{children}</>;
}

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
      <OnboardingController>
        <TourNavigationHandler>{children}</TourNavigationHandler>
      </OnboardingController>
    </TourProvider>
  );
}
