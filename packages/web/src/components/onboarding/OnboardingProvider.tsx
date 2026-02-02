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
function setNavigating(value: boolean, pendingStep?: number) {
  if (typeof window === "undefined") return;
  if (value) {
    sessionStorage.setItem(STORAGE_KEYS.IS_NAVIGATING, "true");
    if (pendingStep !== undefined) {
      sessionStorage.setItem(STORAGE_KEYS.PENDING_STEP, String(pendingStep));
    }
  } else {
    sessionStorage.removeItem(STORAGE_KEYS.IS_NAVIGATING);
    sessionStorage.removeItem(STORAGE_KEYS.PENDING_STEP);
  }
}

function isNavigating(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(STORAGE_KEYS.IS_NAVIGATING) === "true";
}

function getPendingStep(): number | null {
  if (typeof window === "undefined") return null;
  const step = sessionStorage.getItem(STORAGE_KEYS.PENDING_STEP);
  return step ? parseInt(step, 10) : null;
}

/**
 * Componente interno que maneja la lógica del tour con navegación
 */
function OnboardingController({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setIsOpen, isOpen, setCurrentStep } = useTour();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasResumedRef = useRef(false);

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

  // Reanudar tour después de navegación
  useEffect(() => {
    if (hasResumedRef.current) return;

    const pendingStep = getPendingStep();
    if (pendingStep !== null && isNavigating()) {
      hasResumedRef.current = true;

      // Verificar que estamos en la ruta correcta
      const targetRoute = getStepRoute(pendingStep);
      if (targetRoute && pathname === targetRoute) {
        // Esperar a que el elemento esté disponible
        const waitForElement = () => {
          const step = tourSteps[pendingStep];
          const element = step ? document.querySelector(step.target) : null;

          if (element) {
            const action = getStepAction(pendingStep);
            if (action === "scrollToElement") {
              element.scrollIntoView({ behavior: "smooth", block: "center" });
            }

            setTimeout(() => {
              setNavigating(false);
              setCurrentStep(pendingStep);
              setIsOpen(true);
            }, 300);
          } else {
            setTimeout(waitForElement, 100);
          }
        };

        setTimeout(waitForElement, 200);
      }
    }
  }, [pathname, setCurrentStep, setIsOpen]);

  // Mostrar modal de bienvenida si el estado es PENDING y estamos en dashboard
  useEffect(() => {
    if (!isLoading && status === "PENDING" && pathname === "/dashboard" && !isNavigating()) {
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, status, pathname]);

  // Detectar cuando el tour termina (con delay para evitar falsos positivos)
  useEffect(() => {
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }

    if (!isOpen && status === "IN_PROGRESS") {
      completionTimeoutRef.current = setTimeout(() => {
        // Verificar que realmente no estamos navegando
        if (!isNavigating()) {
          updateStatusMutation.mutate({ status: "COMPLETED" });
        }
      }, 1500); // 1.5 segundos de delay
    }

    return () => {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }
    };
  }, [isOpen, status, updateStatusMutation]);

  const startTour = useCallback(() => {
    setShowWelcomeModal(false);
    setNavigating(false);
    updateStatusMutation.mutate({ status: "IN_PROGRESS" });

    if (pathname !== "/dashboard") {
      setNavigating(true, 0);
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
    setNavigating(false);
    updateStatusMutation.mutate({ status: "SKIPPED" });
  }, [updateStatusMutation]);

  const resetTour = useCallback(() => {
    setNavigating(false);
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

/**
 * Componente que maneja la navegación entre pasos
 */
function TourNavigationHandler({ children }: { children: ReactNode }) {
  const { currentStep, setIsOpen, isOpen } = useTour();
  const router = useRouter();
  const pathname = usePathname();
  const prevStepRef = useRef<number | null>(null);

  useEffect(() => {
    // No hacer nada si el tour no está abierto o si estamos navegando
    if (!isOpen || isNavigating()) return;

    // Solo actuar si el paso cambió
    if (prevStepRef.current === currentStep) return;
    prevStepRef.current = currentStep;

    const targetRoute = getStepRoute(currentStep);

    // Si necesitamos navegar a otra página
    if (targetRoute && pathname !== targetRoute) {
      // Guardar estado antes de navegar
      setNavigating(true, currentStep);
      setIsOpen(false);

      // Navegar
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
