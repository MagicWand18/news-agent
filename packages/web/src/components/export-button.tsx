"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import { trpc } from "@/lib/trpc";
import {
  Download,
  Share2,
  ChevronDown,
  Loader2,
  Check,
  Copy,
  X,
  FileDown,
  Link2,
} from "lucide-react";

type ExportType = "campaign" | "brief" | "client";

interface ExportButtonProps {
  type: ExportType;
  referenceId: string;
  className?: string;
}

export function ExportButton({ type, referenceId, className }: ExportButtonProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  const [sharedExpiresAt, setSharedExpiresAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // PDF mutations
  const campaignPDF = trpc.reports.generateCampaignPDF.useMutation();
  const briefPDF = trpc.reports.generateBriefPDF.useMutation();
  const clientPDF = trpc.reports.generateClientPDF.useMutation();
  const createLink = trpc.reports.createSharedLink.useMutation();

  const isPDFLoading = campaignPDF.isPending || briefPDF.isPending || clientPDF.isPending;
  const isLinkLoading = createLink.isPending;

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDownloadPDF = async () => {
    setDropdownOpen(false);
    try {
      let result: { url: string; filename: string };
      switch (type) {
        case "campaign":
          result = await campaignPDF.mutateAsync({ campaignId: referenceId });
          break;
        case "brief":
          result = await briefPDF.mutateAsync({ briefId: referenceId });
          break;
        case "client":
          result = await clientPDF.mutateAsync({ clientId: referenceId });
          break;
      }

      // Descargar PDF desde base64 data URL
      const link = document.createElement("a");
      link.href = result.url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("[ExportButton] PDF generation error:", error);
    }
  };

  const handleShareLink = async () => {
    setDropdownOpen(false);
    try {
      const reportType =
        type === "campaign" ? "CAMPAIGN" as const :
        type === "brief" ? "BRIEF" as const :
        "CLIENT_SUMMARY" as const;

      const result = await createLink.mutateAsync({
        type: reportType,
        referenceId,
        expiresInDays: 7,
      });

      setSharedUrl(`${window.location.origin}${result.url}`);
      setSharedExpiresAt(new Date(result.expiresAt));
      setShareModalOpen(true);
    } catch (error) {
      console.error("[ExportButton] Share link error:", error);
    }
  };

  const handleCopy = async () => {
    if (!sharedUrl) return;
    await navigator.clipboard.writeText(sharedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className={cn("relative", className)} ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          disabled={isPDFLoading || isLinkLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          {isPDFLoading || isLinkLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exportar
          <ChevronDown className="h-3 w-3" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg">
            <button
              onClick={handleDownloadPDF}
              disabled={isPDFLoading}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-t-lg transition-colors"
            >
              <FileDown className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              Descargar PDF
            </button>
            <button
              onClick={handleShareLink}
              disabled={isLinkLoading}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-b-lg transition-colors"
            >
              <Link2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              Compartir link
            </button>
          </div>
        )}
      </div>

      {/* Modal de link compartido */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShareModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <button
              onClick={() => setShareModalOpen(false)}
              className="absolute right-3 top-3 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Share2 className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Link generado
              </h3>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2">
              <input
                type="text"
                readOnly
                value={sharedUrl || ""}
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none truncate"
              />
              <button
                onClick={handleCopy}
                className="flex-shrink-0 rounded p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>

            {sharedExpiresAt && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Este link expira el{" "}
                {sharedExpiresAt.toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}

            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Cualquier persona con este link puede ver el reporte sin autenticarse.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
