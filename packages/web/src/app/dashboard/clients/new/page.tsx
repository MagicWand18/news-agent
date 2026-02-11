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
  Instagram,
  Hash,
  Loader2,
} from "lucide-react";
import { InstagramIcon, TikTokIcon, YouTubeIcon } from "@/components/platform-icons";

type WizardStep = "info" | "search" | "review" | "socials" | "complete";

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
  /** Indica si el artículo está fuera del período solicitado (contexto histórico) */
  isHistorical?: boolean;
}

type SocialPlatform = "TWITTER" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE";

interface SocialAccountInput {
  platform: SocialPlatform;
  handle: string;
  label: string;
  isOwned: boolean;
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
  const [searchDays, setSearchDays] = useState(30);

  // Search results
  const [articles, setArticles] = useState<ArticleResult[]>([]);
  const [searchProgress, setSearchProgress] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // AI suggestions
  const [keywords, setKeywords] = useState<SuggestedKeyword[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // New keyword form
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordType, setNewKeywordType] = useState<SuggestedKeyword["type"]>("TOPIC");

  // Confetti
  const [showConfetti, setShowConfetti] = useState(false);

  // Search warning (when Google CSE is not available)
  const [searchWarning, setSearchWarning] = useState<string | null>(null);

  // Social media state
  const [socialEnabled, setSocialEnabled] = useState(false);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountInput[]>([]);
  const [socialHashtags, setSocialHashtags] = useState<string[]>([]);
  const [newSocialAccount, setNewSocialAccount] = useState<SocialAccountInput>({
    platform: "INSTAGRAM",
    handle: "",
    label: "",
    isOwned: false,
  });
  const [newHashtag, setNewHashtag] = useState("");
  const [isLoadingHashtagSuggestions, setIsLoadingHashtagSuggestions] = useState(false);

  // Mutations
  const searchNewsMutation = trpc.clients.searchNews.useMutation();
  const generateConfigMutation = trpc.clients.generateOnboardingConfig.useMutation();
  const createClientMutation = trpc.clients.createWithOnboarding.useMutation();
  const suggestHashtagsMutation = trpc.social.suggestHashtags.useMutation();

  const steps = ["Info", "Buscar", "Revisar", "Social", "Listo"];
  const stepIndex = { info: 0, search: 1, review: 2, socials: 3, complete: 4 }[step];

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
        days: searchDays,
      });

      setSearchProgress(100);
      clearInterval(progressInterval);

      // Store warning if online search was not available
      if (result.warning) {
        setSearchWarning(result.warning);
      } else {
        setSearchWarning(null);
      }

      setArticles(
        result.articles.map((a) => ({
          ...a,
          publishedAt: a.publishedAt ? new Date(a.publishedAt) : undefined,
          // Artículos históricos deseleccionados por defecto
          selected: !a.isHistorical,
          isHistorical: a.isHistorical || false,
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
          (kw: { word: string; type: string; confidence?: number; reason?: string }) => ({
            word: kw.word,
            type: kw.type as SuggestedKeyword["type"],
            confidence: kw.confidence ?? 0.7,
            reason: kw.reason ?? "",
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

  // Ir al paso de redes sociales
  const handleGoToSocials = () => {
    setStep("socials");
  };

  // Sugerir hashtags y cuentas con IA
  const handleSuggestWithAI = async () => {
    setIsLoadingHashtagSuggestions(true);
    try {
      const existingKeywords = keywords.filter((k) => k.selected).map((k) => k.word);
      const result = await suggestHashtagsMutation.mutateAsync({
        clientName: clientName.trim(),
        description: description || undefined,
        industry: industry || undefined,
        existingKeywords,
        competitors, // Pasar competidores ya identificados
      });

      // Pre-poblar hashtags evitando duplicados
      if (result.hashtags && result.hashtags.length > 0) {
        const newHashtags = result.hashtags
          .map((h: { hashtag: string }) => h.hashtag.replace(/^#/, ""))
          .filter((h: string) => !socialHashtags.includes(h));
        setSocialHashtags((prev) => [...prev, ...newHashtags]);
      }

      // Pre-poblar cuentas evitando duplicados
      if (result.suggestedAccounts && result.suggestedAccounts.length > 0) {
        const newAccounts = result.suggestedAccounts
          .filter(
            (a: { platform: SocialPlatform; handle: string }) =>
              !socialAccounts.some(
                (existing) =>
                  existing.platform === a.platform &&
                  existing.handle === a.handle.replace(/^@/, "")
              )
          )
          .map((a: { platform: SocialPlatform; handle: string; reason?: string }) => ({
            platform: a.platform,
            handle: a.handle.replace(/^@/, ""),
            label: a.reason ?? "",
            isOwned: false,
          }));
        setSocialAccounts((prev) => [...prev, ...newAccounts]);
      }
    } catch (error) {
      console.error("Error suggesting hashtags:", error);
    } finally {
      setIsLoadingHashtagSuggestions(false);
    }
  };

  // Agregar cuenta social
  const handleAddSocialAccount = () => {
    if (!newSocialAccount.handle.trim()) return;
    const cleanHandle = newSocialAccount.handle.replace(/^@/, "").trim();
    if (socialAccounts.some((a) => a.platform === newSocialAccount.platform && a.handle === cleanHandle)) {
      return; // Ya existe
    }
    setSocialAccounts((prev) => [
      ...prev,
      { ...newSocialAccount, handle: cleanHandle },
    ]);
    setNewSocialAccount({
      platform: newSocialAccount.platform,
      handle: "",
      label: "",
      isOwned: false,
    });
  };

  // Remover cuenta social
  const removeSocialAccount = (index: number) => {
    setSocialAccounts((prev) => prev.filter((_, i) => i !== index));
  };

  // Agregar hashtag
  const handleAddHashtag = () => {
    if (!newHashtag.trim()) return;
    const cleanHashtag = newHashtag.replace(/^#/, "").trim();
    if (socialHashtags.includes(cleanHashtag)) return;
    setSocialHashtags((prev) => [...prev, cleanHashtag]);
    setNewHashtag("");
  };

  // Remover hashtag
  const removeHashtag = (hashtag: string) => {
    setSocialHashtags((prev) => prev.filter((h) => h !== hashtag));
  };

  // Icono de plataforma
  const getPlatformIcon = (platform: SocialPlatform) => {
    switch (platform) {
      case "INSTAGRAM":
        return <InstagramIcon className="h-4 w-4" />;
      case "TIKTOK":
        return <TikTokIcon className="h-4 w-4" />;
      case "YOUTUBE":
        return <YouTubeIcon className="h-4 w-4" />;
      default:
        return <Instagram className="h-4 w-4" />;
    }
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
        // Redes sociales
        socialMonitoringEnabled: socialEnabled,
        socialHashtags: socialEnabled ? socialHashtags : [],
        socialAccounts: socialEnabled ? socialAccounts : [],
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {step === "complete" ? "¡Cliente Creado!" : "Crear Nuevo Cliente"}
        </h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          {step === "info" && "Ingresa la información básica del cliente"}
          {step === "search" && "Buscando noticias relevantes..."}
          {step === "review" && "Revisa y personaliza la configuración"}
          {step === "socials" && "Configura el monitoreo de redes sociales"}
          {step === "complete" && "El monitoreo está activo"}
        </p>
      </div>

      {/* Stepper */}
      <WizardStepper steps={steps} currentStep={stepIndex} />

      {/* Step Content */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-8 shadow-lg dark:shadow-gray-900/30">
        {/* PASO 1: Información básica */}
        {step === "info" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nombre de la empresa/persona *
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                placeholder="Ej: Coca-Cola México"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Descripción (opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                placeholder="Breve descripción del cliente y su actividad..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Industria</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              >
                <option value="">Selecciona una industria</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Período de búsqueda
              </label>
              <select
                value={searchDays}
                onChange={(e) => setSearchDays(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              >
                <option value={7}>Últimos 7 días</option>
                <option value={14}>Últimos 14 días</option>
                <option value={30}>Últimos 30 días (recomendado)</option>
                <option value={45}>Últimos 45 días</option>
                <option value={60}>Últimos 60 días</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Mientras más días, más noticias pero puede tardar más
              </p>
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
                  <div className="mt-6 space-y-2 text-center text-sm text-gray-500 dark:text-gray-400">
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
                  <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
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
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <Search className="h-5 w-5 text-brand-600" />
                Noticias Encontradas ({articles.filter((a) => a.selected).length}/
                {articles.length})
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Selecciona las noticias relevantes para crear menciones iniciales
              </p>

              <div className="mt-4 max-h-80 space-y-2 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
                {articles.length === 0 ? (
                  <p className="py-4 text-center text-gray-500 dark:text-gray-400">
                    No se encontraron noticias recientes
                  </p>
                ) : (
                  <>
                    {/* Noticias recientes (dentro del período) */}
                    {articles.filter((a) => !a.isHistorical).length > 0 && (
                      <>
                        <div className="flex items-center gap-2 pb-2">
                          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-600" />
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Últimos {searchDays} días
                          </span>
                          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-600" />
                        </div>
                        {articles
                          .filter((a) => !a.isHistorical)
                          .map((article, index) => (
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
                              onSelect={() => toggleArticle(articles.indexOf(article))}
                              isHistorical={false}
                            />
                          ))}
                      </>
                    )}

                    {/* Noticias históricas (fuera del período) */}
                    {articles.filter((a) => a.isHistorical).length > 0 && (
                      <>
                        <div className="flex items-center gap-2 py-3">
                          <div className="h-px flex-1 bg-amber-200 dark:bg-amber-800" />
                          <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Contexto histórico
                          </span>
                          <div className="h-px flex-1 bg-amber-200 dark:bg-amber-800" />
                        </div>
                        <p className="text-xs text-amber-600 dark:text-amber-500 mb-2 text-center">
                          Artículos anteriores al período solicitado. Útiles para contexto pero deseleccionados por defecto.
                        </p>
                        {articles
                          .filter((a) => a.isHistorical)
                          .map((article, index) => (
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
                              onSelect={() => toggleArticle(articles.indexOf(article))}
                              isHistorical={true}
                            />
                          ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Keywords sugeridos */}
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <Sparkles className="h-5 w-5 text-brand-600" />
                Keywords Sugeridos ({keywords.filter((k) => k.selected).length})
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                  onKeyPress={(e) => e.key === "Enter" && handleAddKeyword()}
                />
                <select
                  value={newKeywordType}
                  onChange={(e) => setNewKeywordType(e.target.value as SuggestedKeyword["type"])}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
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
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Competidores Identificados
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {competitors.map((comp) => (
                  <span
                    key={comp}
                    className="flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/30 px-3 py-1 text-sm text-orange-700 dark:text-orange-400"
                  >
                    {comp}
                    <button
                      onClick={() => setCompetitors(competitors.filter((c) => c !== comp))}
                      className="ml-1 text-orange-500 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {competitors.length === 0 && (
                  <span className="text-sm text-gray-400 dark:text-gray-500">Sin competidores. Agrega manualmente abajo.</span>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  placeholder="Nombre del competidor"
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCompetitor.trim()) {
                      e.preventDefault();
                      if (!competitors.includes(newCompetitor.trim())) {
                        setCompetitors([...competitors, newCompetitor.trim()]);
                      }
                      setNewCompetitor("");
                    }
                  }}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                />
                <button
                  onClick={() => {
                    if (newCompetitor.trim() && !competitors.includes(newCompetitor.trim())) {
                      setCompetitors([...competitors, newCompetitor.trim()]);
                    }
                    setNewCompetitor("");
                  }}
                  disabled={!newCompetitor.trim()}
                  className="flex items-center gap-1 rounded-lg bg-orange-100 dark:bg-orange-900/30 px-3 py-2 text-sm text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Agregar
                </button>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep("info")}
                className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </button>
              <button
                onClick={handleGoToSocials}
                disabled={keywords.filter((k) => k.selected).length === 0}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                Siguiente: Redes Sociales
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* PASO 4: Redes Sociales */}
        {step === "socials" && (
          <div className="space-y-8">
            {/* Toggle de habilitación */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 p-2">
                  <Hash className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Monitoreo de Redes Sociales</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Instagram, TikTok y YouTube
                  </p>
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={socialEnabled}
                  onChange={(e) => setSocialEnabled(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full dark:bg-gray-600"></div>
              </label>
            </div>

            {socialEnabled && (
              <>
                {/* Sección de sugerencias con IA */}
                <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 p-2">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">Sugerencias con IA</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Genera hashtags y cuentas relevantes automáticamente
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleSuggestWithAI}
                      disabled={isLoadingHashtagSuggestions}
                      className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-medium text-white hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all min-w-[145px]"
                    >
                      {isLoadingHashtagSuggestions ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Sugerir con IA
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-amber-500"></span>
                    Las sugerencias son generadas por un modelo experimental. Revisa y elimina cualquier cuenta que no sea relevante antes de continuar.
                  </p>
                </div>

                {/* Cuentas a monitorear */}
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                    <Hash className="h-5 w-5 text-brand-600" />
                    Cuentas a Monitorear
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Agrega cuentas propias del cliente o de competidores/influencers
                  </p>

                  {/* Lista de cuentas */}
                  {socialAccounts.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {socialAccounts.map((account, index) => (
                        <div
                          key={`${account.platform}-${account.handle}`}
                          className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className={`rounded-full p-1.5 ${
                              account.platform === "INSTAGRAM" ? "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400" :
                              account.platform === "YOUTUBE" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                              "bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300"
                            }`}>
                              {getPlatformIcon(account.platform)}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                @{account.handle}
                                {account.isOwned && (
                                  <span className="ml-2 text-xs text-green-600 dark:text-green-400">(Propia)</span>
                                )}
                              </p>
                              {account.label && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">{account.label}</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => removeSocialAccount(index)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Agregar cuenta */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <select
                      value={newSocialAccount.platform}
                      onChange={(e) => setNewSocialAccount((prev) => ({ ...prev, platform: e.target.value as SocialPlatform }))}
                      className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                    >
                      <option value="INSTAGRAM">Instagram</option>
                      <option value="TIKTOK">TikTok</option>
                      <option value="YOUTUBE">YouTube</option>
                    </select>
                    <input
                      type="text"
                      value={newSocialAccount.handle}
                      onChange={(e) => setNewSocialAccount((prev) => ({ ...prev, handle: e.target.value }))}
                      placeholder="@username"
                      className="flex-1 min-w-[150px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                      onKeyPress={(e) => e.key === "Enter" && handleAddSocialAccount()}
                    />
                    <input
                      type="text"
                      value={newSocialAccount.label}
                      onChange={(e) => setNewSocialAccount((prev) => ({ ...prev, label: e.target.value }))}
                      placeholder="Etiqueta (opcional)"
                      className="flex-1 min-w-[120px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                    />
                    <label className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200">
                      <input
                        type="checkbox"
                        checked={newSocialAccount.isOwned}
                        onChange={(e) => setNewSocialAccount((prev) => ({ ...prev, isOwned: e.target.checked }))}
                        className="rounded"
                      />
                      Propia
                    </label>
                    <button
                      onClick={handleAddSocialAccount}
                      disabled={!newSocialAccount.handle.trim()}
                      className="rounded-lg bg-brand-100 dark:bg-brand-900/30 px-3 py-2 text-brand-700 dark:text-brand-400 hover:bg-brand-200 dark:hover:bg-brand-900/50 disabled:opacity-50"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Hashtags */}
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                    <Hash className="h-5 w-5 text-brand-600" />
                    Hashtags a Monitorear
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Hashtags relevantes para el cliente (sin el #)
                  </p>

                  {/* Lista de hashtags */}
                  {socialHashtags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {socialHashtags.map((hashtag) => (
                        <span
                          key={hashtag}
                          className="flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/30 px-3 py-1 text-sm text-purple-700 dark:text-purple-400"
                        >
                          #{hashtag}
                          <button
                            onClick={() => removeHashtag(hashtag)}
                            className="ml-1 hover:text-purple-900 dark:hover:text-purple-200"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Agregar hashtag */}
                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      value={newHashtag}
                      onChange={(e) => setNewHashtag(e.target.value)}
                      placeholder="Agregar hashtag..."
                      className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                      onKeyPress={(e) => e.key === "Enter" && handleAddHashtag()}
                    />
                    <button
                      onClick={handleAddHashtag}
                      disabled={!newHashtag.trim()}
                      className="rounded-lg bg-brand-100 dark:bg-brand-900/30 px-3 py-2 text-brand-700 dark:text-brand-400 hover:bg-brand-200 dark:hover:bg-brand-900/50 disabled:opacity-50"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Sugerencias automáticas */}
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Tip: Agrega el nombre del cliente, marcas, productos y hashtags de la industria
                  </p>
                </div>
              </>
            )}

            {/* Botones de acción */}
            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep("review")}
                className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </button>
              <button
                onClick={handleCreateClient}
                disabled={createClientMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {createClientMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    Crear Cliente
                    <Check className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* PASO 5: Completado */}
        {step === "complete" && (
          <div className="py-12 text-center">
            <PulseGlow>
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <Check className="h-10 w-10 text-green-600" />
              </div>
            </PulseGlow>

            <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-white">{clientName}</h2>

            <div className="mx-auto mt-6 grid max-w-md gap-4 text-left">
              <div className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
                  <Search className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{articles.filter((a) => a.selected).length} menciones</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">importadas al sistema</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-2">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{keywords.filter((k) => k.selected).length} keywords</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">configurados para monitoreo</p>
                </div>
              </div>

              {competitors.length > 0 && (
                <div className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                  <div className="rounded-lg bg-orange-100 dark:bg-orange-900/30 p-2">
                    <Building2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{competitors.length} competidores</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">identificados</p>
                  </div>
                </div>
              )}

              {socialEnabled && (
                <div className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                  <div className="rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 p-2">
                    <Hash className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {socialAccounts.length} cuentas, {socialHashtags.length} hashtags
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">monitoreo de redes sociales activo</p>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-6 text-gray-500 dark:text-gray-400">
              Ahora recibirás alertas cuando tu cliente aparezca en los medios
              {socialEnabled && " y redes sociales"}.
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

      {/* Warning message (when online search not available) */}
      {searchWarning && !isSearching && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 p-4 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {searchWarning}
        </div>
      )}

      {/* Error message */}
      {(searchNewsMutation.isError ||
        generateConfigMutation.isError ||
        createClientMutation.isError) && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-4 text-sm text-red-700 dark:text-red-400">
          Error:{" "}
          {searchNewsMutation.error?.message ||
            generateConfigMutation.error?.message ||
            createClientMutation.error?.message}
        </div>
      )}
    </div>
  );
}
