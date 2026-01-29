"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  WizardStepper,
  SparkleEffect,
  MagicProgress,
  SearchingAnimation,
  NewsCardAnimated,
  KeywordChip,
  ConfettiEffect,
  PulseGlow,
} from "@/components/client-wizard/magic-effects";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Building2,
  Search,
  Check,
  Plus,
  X,
} from "lucide-react";

type WizardStep = "info" | "search" | "review" | "complete";

interface SuggestedKeyword {
  word: string;
  type: "NAME" | "BRAND" | "COMPETITOR" | "TOPIC" | "ALIAS";
  confidence: number;
  reason: string;
  selected: boolean;
}

interface ArticleResult {
  id: string;
  title: string;
  source: string;
  url: string;
  snippet?: string;
  publishedAt?: Date;
  selected: boolean;
}

const INDUSTRIES = [
  "Tecnología",
  "Finanzas",
  "Salud",
  "Retail",
  "Manufactura",
  "Alimentos y Bebidas",
  "Energía",
  "Automotriz",
  "Inmobiliario",
  "Entretenimiento",
  "Educación",
  "Gobierno",
  "Otro",
];

export default function NewClientWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("info");

  // Form state
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");

  // Search results
  const [articles, setArticles] = useState<ArticleResult[]>([]);
  const [searchProgress, setSearchProgress] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // AI suggestions
  const [keywords, setKeywords] = useState<SuggestedKeyword[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // New keyword form
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordType, setNewKeywordType] = useState<SuggestedKeyword["type"]>("TOPIC");

  // Confetti
  const [showConfetti, setShowConfetti] = useState(false);

  // Mutations
  const searchNewsMutation = trpc.clients.searchNews.useMutation();
  const generateConfigMutation = trpc.clients.generateOnboardingConfig.useMutation();
  const createClientMutation = trpc.clients.createWithOnboarding.useMutation();

  const steps = ["Info", "Buscar", "Revisar", "Listo"];
  const stepIndex = { info: 0, search: 1, review: 2, complete: 3 }[step];

  // Paso 1: Ir a búsqueda
  const handleStartSearch = async () => {
    if (!clientName.trim()) return;

    setStep("search");
    setIsSearching(true);
    setSearchProgress(0);

    // Simular progreso mientras busca
    const progressInterval = setInterval(() => {
      setSearchProgress((prev) => Math.min(prev + Math.random() * 15, 90));
    }, 500);

    try {
      const result = await searchNewsMutation.mutateAsync({
        clientName: clientName.trim(),
        industry: industry || undefined,
        days: 30,
      });

      setSearchProgress(100);
      clearInterval(progressInterval);

      setArticles(
        result.articles.map((a) => ({
          ...a,
          publishedAt: a.publishedAt ? new Date(a.publishedAt) : undefined,
          selected: true,
        }))
      );

      // Generar configuración con IA
      await generateAIConfig(result.articles);
    } catch (error) {
      console.error("Search error:", error);
      clearInterval(progressInterval);
    } finally {
      setIsSearching(false);
    }
  };

  const generateAIConfig = async (
    foundArticles: Array<{ title: string; source: string; snippet?: string }>
  ) => {
    setIsGenerating(true);

    try {
      const config = await generateConfigMutation.mutateAsync({
        clientName: clientName.trim(),
        description: description || undefined,
        industry: industry || undefined,
        articles: foundArticles.slice(0, 15),
      });

      // Procesar keywords
      setKeywords(
        (config.suggestedKeywords || []).map(
          (kw: { word: string; type: string; confidence: number; reason: string }) => ({
            word: kw.word,
            type: kw.type as SuggestedKeyword["type"],
            confidence: kw.confidence,
            reason: kw.reason,
            selected: true,
          })
        )
      );

      // Procesar competidores
      setCompetitors(
        (config.competitors || []).map((c: { name: string } | string) =>
          typeof c === "string" ? c : c.name
        )
      );

      setStep("review");
    } catch (error) {
      console.error("AI generation error:", error);
      // Fallback: crear keyword básico
      setKeywords([
        {
          word: clientName,
          type: "NAME",
          confidence: 1,
          reason: "Nombre del cliente",
          selected: true,
        },
      ]);
      setStep("review");
    } finally {
      setIsGenerating(false);
    }
  };

  // Agregar keyword manual
  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    setKeywords((prev) => [
      ...prev,
      {
        word: newKeyword.trim(),
        type: newKeywordType,
        confidence: 1,
        reason: "Agregado manualmente",
        selected: true,
      },
    ]);
    setNewKeyword("");
  };

  // Toggle selección de keyword
  const toggleKeyword = (index: number) => {
    setKeywords((prev) =>
      prev.map((kw, i) => (i === index ? { ...kw, selected: !kw.selected } : kw))
    );
  };

  // Remover keyword
  const removeKeyword = (index: number) => {
    setKeywords((prev) => prev.filter((_, i) => i !== index));
  };

  // Toggle selección de artículo
  const toggleArticle = (index: number) => {
    setArticles((prev) =>
      prev.map((a, i) => (i === index ? { ...a, selected: !a.selected } : a))
    );
  };

  // Crear cliente final
  const handleCreateClient = async () => {
    const selectedKeywords = keywords.filter((kw) => kw.selected);
    const selectedArticleIds = articles.filter((a) => a.selected).map((a) => a.id);

    try {
      await createClientMutation.mutateAsync({
        name: clientName.trim(),
        description: description || undefined,
        industry: industry || undefined,
        keywords: selectedKeywords.map((kw) => ({
          word: kw.word,
          type: kw.type,
        })),
        competitors,
        selectedArticleIds,
      });

      setShowConfetti(true);
      setStep("complete");
    } catch (error) {
      console.error("Create client error:", error);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      <ConfettiEffect active={showConfetti} />

      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {step === "complete" ? "¡Cliente Creado!" : "Crear Nuevo Cliente"}
        </h1>
        <p className="mt-2 text-gray-500">
          {step === "info" && "Ingresa la información básica del cliente"}
          {step === "search" && "Buscando noticias relevantes..."}
          {step === "review" && "Revisa y personaliza la configuración"}
          {step === "complete" && "El monitoreo está activo"}
        </p>
      </div>

      {/* Stepper */}
      <WizardStepper steps={steps} currentStep={stepIndex} />

      {/* Step Content */}
      <div className="rounded-2xl bg-white p-8 shadow-lg">
        {/* PASO 1: Información básica */}
        {step === "info" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nombre de la empresa/persona *
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                placeholder="Ej: Coca-Cola México"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Descripción (opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                placeholder="Breve descripción del cliente y su actividad..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Industria</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              >
                <option value="">Selecciona una industria</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleStartSearch}
                disabled={!clientName.trim()}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                Buscar Noticias
                <Sparkles className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* PASO 2: Búsqueda con animación */}
        {step === "search" && (
          <div className="relative min-h-[400px]">
            <SparkleEffect count={15} />

            <div className="flex flex-col items-center justify-center py-12">
              {isSearching ? (
                <>
                  <SearchingAnimation text="Buscando noticias relevantes..." />
                  <div className="mt-8 w-full max-w-md">
                    <MagicProgress progress={searchProgress} label="Progreso" />
                  </div>
                  <div className="mt-6 space-y-2 text-center text-sm text-gray-500">
                    <p>
                      <Search className="mr-2 inline h-4 w-4" />
                      Analizando medios mexicanos...
                    </p>
                    {searchProgress > 30 && (
                      <p className="animate-fade-in">
                        <Building2 className="mr-2 inline h-4 w-4" />
                        {articles.length || "..."} artículos encontrados
                      </p>
                    )}
                  </div>
                </>
              ) : isGenerating ? (
                <>
                  <SearchingAnimation text="Generando configuración con IA..." />
                  <p className="mt-4 text-sm text-gray-500">
                    Analizando contenido y extrayendo keywords...
                  </p>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* PASO 3: Revisión */}
        {step === "review" && (
          <div className="space-y-8">
            {/* Noticias encontradas */}
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Search className="h-5 w-5 text-brand-600" />
                Noticias Encontradas ({articles.filter((a) => a.selected).length}/
                {articles.length})
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Selecciona las noticias relevantes para crear menciones iniciales
              </p>

              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-lg border bg-gray-50 p-4">
                {articles.length === 0 ? (
                  <p className="py-4 text-center text-gray-500">
                    No se encontraron noticias recientes
                  </p>
                ) : (
                  articles.map((article, index) => (
                    <NewsCardAnimated
                      key={article.id}
                      title={article.title}
                      source={article.source}
                      date={
                        article.publishedAt
                          ? new Date(article.publishedAt).toLocaleDateString("es-MX")
                          : undefined
                      }
                      index={index}
                      selected={article.selected}
                      onSelect={() => toggleArticle(index)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Keywords sugeridos */}
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Sparkles className="h-5 w-5 text-brand-600" />
                Keywords Sugeridos ({keywords.filter((k) => k.selected).length})
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Haz clic para seleccionar/deseleccionar
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {keywords.map((kw, index) => (
                  <KeywordChip
                    key={`${kw.word}-${index}`}
                    word={kw.word}
                    type={kw.type}
                    selected={kw.selected}
                    onToggle={() => toggleKeyword(index)}
                    onRemove={() => removeKeyword(index)}
                  />
                ))}
              </div>

              {/* Agregar keyword */}
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Agregar keyword..."
                  className="flex-1 rounded-lg border px-3 py-2 text-sm"
                  onKeyPress={(e) => e.key === "Enter" && handleAddKeyword()}
                />
                <select
                  value={newKeywordType}
                  onChange={(e) => setNewKeywordType(e.target.value as SuggestedKeyword["type"])}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="NAME">Nombre</option>
                  <option value="BRAND">Marca</option>
                  <option value="COMPETITOR">Competidor</option>
                  <option value="TOPIC">Tema</option>
                  <option value="ALIAS">Alias</option>
                </select>
                <button
                  onClick={handleAddKeyword}
                  disabled={!newKeyword.trim()}
                  className="rounded-lg bg-brand-100 px-3 py-2 text-brand-700 hover:bg-brand-200 disabled:opacity-50"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Competidores */}
            {competitors.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Competidores Identificados
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {competitors.map((comp) => (
                    <span
                      key={comp}
                      className="rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-700"
                    >
                      {comp}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep("info")}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </button>
              <button
                onClick={handleCreateClient}
                disabled={createClientMutation.isPending || keywords.filter((k) => k.selected).length === 0}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {createClientMutation.isPending ? (
                  "Creando..."
                ) : (
                  <>
                    Crear Cliente
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* PASO 4: Completado */}
        {step === "complete" && (
          <div className="py-12 text-center">
            <PulseGlow>
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <Check className="h-10 w-10 text-green-600" />
              </div>
            </PulseGlow>

            <h2 className="mt-6 text-2xl font-bold text-gray-900">{clientName}</h2>

            <div className="mx-auto mt-6 grid max-w-md gap-4 text-left">
              <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                <div className="rounded-lg bg-blue-100 p-2">
                  <Search className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">{articles.filter((a) => a.selected).length} menciones</p>
                  <p className="text-sm text-gray-500">importadas al sistema</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                <div className="rounded-lg bg-purple-100 p-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">{keywords.filter((k) => k.selected).length} keywords</p>
                  <p className="text-sm text-gray-500">configurados para monitoreo</p>
                </div>
              </div>

              {competitors.length > 0 && (
                <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                  <div className="rounded-lg bg-orange-100 p-2">
                    <Building2 className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium">{competitors.length} competidores</p>
                    <p className="text-sm text-gray-500">identificados</p>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-6 text-gray-500">
              Ahora recibirás alertas cuando tu cliente aparezca en los medios.
            </p>

            <button
              onClick={() => router.push("/dashboard/clients")}
              className="mt-8 rounded-lg bg-brand-600 px-8 py-3 font-medium text-white transition hover:bg-brand-700"
            >
              Ver Dashboard
            </button>
          </div>
        )}
      </div>

      {/* Error message */}
      {(searchNewsMutation.isError ||
        generateConfigMutation.isError ||
        createClientMutation.isError) && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          Error:{" "}
          {searchNewsMutation.error?.message ||
            generateConfigMutation.error?.message ||
            createClientMutation.error?.message}
        </div>
      )}
    </div>
  );
}
