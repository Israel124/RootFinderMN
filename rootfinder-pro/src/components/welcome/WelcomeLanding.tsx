import { ChevronRight, Zap, BarChart3, BookOpen, Sparkles, TrendingUp, Lock, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandLogo } from '@/components/brand/BrandLogo';

interface WelcomeLandingProps {
  userName?: string;
  onNavigateToLab: () => void;
  onNavigateToRootFinder: () => void;
}

export function WelcomeLanding({
  userName = 'Usuario',
  onNavigateToLab,
  onNavigateToRootFinder,
}: WelcomeLandingProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Header con Logo y Botones de Navegación */}
      <header className="relative border-b border-slate-700/50 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <BrandLogo />
          <div className="flex gap-3">
            <Button
              onClick={onNavigateToRootFinder}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
            >
              Entrar al Laboratorio Pro
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-12">
        {/* Hero Section */}
        <div className="mb-16 text-center">
          <h1 className="mb-4 text-5xl font-bold text-white">
            Bienvenido <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{userName}</span>
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-slate-400">
            Descubre el poder de RootFinder, tu laboratorio de métodos numéricos y análisis matemático avanzado.
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="mb-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Métodos Disponibles */}
          <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur-sm hover:border-blue-500/50 hover:bg-slate-900/80 transition-all duration-300">
            <CardHeader>
              <div className="mb-3 inline-flex rounded-lg bg-blue-500/10 p-3">
                <Zap className="h-6 w-6 text-blue-400" />
              </div>
              <CardTitle className="text-white">Métodos Numéricos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-blue-400">8+</p>
              <p className="mt-2 text-sm text-slate-400">Algoritmos de resolución de raíces</p>
            </CardContent>
          </Card>

          {/* Card 2: Análisis Polinómico */}
          <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur-sm hover:border-cyan-500/50 hover:bg-slate-900/80 transition-all duration-300">
            <CardHeader>
              <div className="mb-3 inline-flex rounded-lg bg-cyan-500/10 p-3">
                <BarChart3 className="h-6 w-6 text-cyan-400" />
              </div>
              <CardTitle className="text-white">Polinomios</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-cyan-400">∞</p>
              <p className="mt-2 text-sm text-slate-400">Raíces de grado ilimitado</p>
            </CardContent>
          </Card>

          {/* Card 3: Series de Taylor */}
          <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur-sm hover:border-purple-500/50 hover:bg-slate-900/80 transition-all duration-300">
            <CardHeader>
              <div className="mb-3 inline-flex rounded-lg bg-purple-500/10 p-3">
                <TrendingUp className="h-6 w-6 text-purple-400" />
              </div>
              <CardTitle className="text-white">Series Taylor</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-purple-400">100%</p>
              <p className="mt-2 text-sm text-slate-400">Aproximaciones precisas</p>
            </CardContent>
          </Card>

          {/* Card 4: Seguridad */}
          <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur-sm hover:border-green-500/50 hover:bg-slate-900/80 transition-all duration-300">
            <CardHeader>
              <div className="mb-3 inline-flex rounded-lg bg-green-500/10 p-3">
                <Lock className="h-6 w-6 text-green-400" />
              </div>
              <CardTitle className="text-white">Seguro</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-green-400">SSL</p>
              <p className="mt-2 text-sm text-slate-400">Encriptación de datos</p>
            </CardContent>
          </Card>
        </div>

        {/* Features Section */}
        <section className="mb-16">
          <h2 className="mb-8 text-3xl font-bold text-white">Características Principales</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Feature 1 */}
            <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white">Análisis Visual Interactivo</CardTitle>
                    <CardDescription className="text-slate-400">Visualiza gráficos en tiempo real</CardDescription>
                  </div>
                  <Sparkles className="h-5 w-5 text-blue-400" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">
                  Observa cómo convergen los algoritmos con gráficos dinámicos que se actualizan en tiempo real.
                </p>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white">Control Preciso</CardTitle>
                    <CardDescription className="text-slate-400">Ajusta parámetros al detalle</CardDescription>
                  </div>
                  <Gauge className="h-5 w-5 text-cyan-400" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">
                  Personaliza tolerancia, iteraciones máximas y otros parámetros para cada método.
                </p>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white">Historial Completo</CardTitle>
                    <CardDescription className="text-slate-400">Accede a tus cálculos anteriores</CardDescription>
                  </div>
                  <BookOpen className="h-5 w-5 text-purple-400" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">
                  Consulta tu historial de cálculos, exporta resultados y organiza tu trabajo.
                </p>
              </CardContent>
            </Card>

            {/* Feature 4 */}
            <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white">Sistemas de Ecuaciones</CardTitle>
                    <CardDescription className="text-slate-400">Newton-Raphson multivariable</CardDescription>
                  </div>
                  <TrendingUp className="h-5 w-5 text-green-400" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">
                  Resuelve sistemas complejos de ecuaciones no lineales con métodos avanzados.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Getting Started Section */}
        <section className="mb-16 rounded-lg border border-slate-700/50 bg-gradient-to-r from-blue-950/30 to-cyan-950/30 p-8 backdrop-blur-sm">
          <h2 className="mb-8 text-3xl font-bold text-white">Guía de Inicio Rápido</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {/* Step 1 */}
            <div className="relative">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold">
                1
              </div>
              <h3 className="mb-2 font-semibold text-white">Selecciona un Método</h3>
              <p className="text-slate-400">
                Elige entre Bisección, Newton-Raphson, Secante, Regula Falsi y más métodos numéricos.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold">
                2
              </div>
              <h3 className="mb-2 font-semibold text-white">Ingresa tu Función</h3>
              <p className="text-slate-400">
                Escribe tu ecuación matemática en notación estándar (ej: x^2 - 4*x + 3 = 0).
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold">
                3
              </div>
              <h3 className="mb-2 font-semibold text-white">Obtén Resultados</h3>
              <p className="text-slate-400">
                Visualiza la raíz encontrada, iteraciones convergentes y gráficos detallados.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-8 text-center backdrop-blur-sm">
          <h2 className="mb-4 text-2xl font-bold text-white">¿Listo para comenzar?</h2>
          <p className="mb-8 text-slate-400">Accede a todas las herramientas de RootFinder ahora</p>
          <div className="flex justify-center gap-4">
            <Button
              onClick={onNavigateToRootFinder}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
            >
              Ir al Laboratorio Pro
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 bg-slate-950/80 py-6 text-center text-slate-500">
        <p>© 2026 RootFinder Pro | Desarrollado por el equipo de RootFinder Pro | Métodos Numéricos y Análisis Matemático Avanzado</p>
      </footer>
    </div>
  );
}
