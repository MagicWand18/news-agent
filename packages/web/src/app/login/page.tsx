"use client";

import { signIn, useSession } from "next-auth/react";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Newspaper, BarChart3, Bell, Shield } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Credenciales invalidas. Verifica tu email y contrasena.");
      setLoading(false);
    } else {
      router.push(callbackUrl);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@agencia.com"
          className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Contrasena
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
          className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="relative w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Ingresando...
          </span>
        ) : (
          "Ingresar"
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left panel - Branding con Aurora */}
      <AuroraBackground
        variant="brand"
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 text-white"
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Newspaper className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold">MediaBot</h1>
          </div>
          <p className="mt-2 text-blue-200">Plataforma de monitoreo de medios con IA</p>
        </div>

        <div className="space-y-8">
          <h2 className="text-4xl font-bold leading-tight">
            Monitoreo inteligente de medios para tu agencia de PR
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <Feature
              icon={<BarChart3 className="h-5 w-5" />}
              title="Analisis con IA"
              description="Analisis automatico de sentimiento y relevancia"
            />
            <Feature
              icon={<Bell className="h-5 w-5" />}
              title="Alertas en tiempo real"
              description="Notificaciones inmediatas via Telegram"
            />
            <Feature
              icon={<Shield className="h-5 w-5" />}
              title="Multi-fuente"
              description="Cobertura de +10 fuentes de noticias"
            />
          </div>
        </div>

        <p className="text-sm text-blue-200">
          MediaBot - Monitoreo de medios profesional
        </p>
      </AuroraBackground>

      {/* Right panel - Login form */}
      <div className="flex w-full items-center justify-center bg-gray-50 px-4 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Newspaper className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold text-brand-900">MediaBot</h1>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Iniciar sesion</h2>
            <p className="mt-2 text-gray-500">
              Ingresa tus credenciales para acceder al dashboard
            </p>
          </div>

          <Suspense fallback={<div className="text-center text-gray-400">Cargando...</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-white/10 p-3 backdrop-blur-sm">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/20">
        {icon}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-blue-200">{description}</p>
      </div>
    </div>
  );
}
