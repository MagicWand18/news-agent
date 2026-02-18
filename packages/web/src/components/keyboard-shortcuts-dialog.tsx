"use client";

import { useEffect } from "react";
import { X, Command } from "lucide-react";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

const isMac =
  typeof navigator !== "undefined"
    ? /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
    : true;
const modKey = isMac ? "\u2318" : "Ctrl";

const shortcuts = [
  {
    category: "General",
    items: [
      { keys: [`${modKey}+K`], description: "Abrir busqueda rapida" },
      { keys: ["?"], description: "Mostrar atajos de teclado" },
      { keys: ["Esc"], description: "Cerrar dialogo / deseleccionar" },
    ],
  },
  {
    category: "Navegacion",
    items: [
      { keys: ["g", "d"], description: "Ir a Dashboard" },
      { keys: ["g", "m"], description: "Ir a Menciones" },
      { keys: ["g", "s"], description: "Ir a Redes Sociales" },
      { keys: ["g", "c"], description: "Ir a Clientes" },
      { keys: ["g", "k"], description: "Ir a Crisis" },
      { keys: ["g", "i"], description: "Ir a Intelligence" },
    ],
  },
];

export function KeyboardShortcutsDialog({
  open,
  onClose,
}: KeyboardShortcutsDialogProps) {
  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Command className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Atajos de teclado
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {shortcuts.map((group) => (
            <div key={group.category}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {group.category}
              </h3>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, i) => (
                        <span key={i}>
                          {i > 0 && (
                            <span className="mx-1 text-xs text-gray-400">
                              luego
                            </span>
                          )}
                          <kbd className="inline-flex min-w-[24px] items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
