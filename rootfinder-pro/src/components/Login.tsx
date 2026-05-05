import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Radar,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { apiUrl } from '@/lib/apiConfig';

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

interface LoginProps {
  onLogin: (token: string, user: any) => void;
  onSwitchToRegister: () => void;
}

export function Login({ onLogin, onSwitchToRegister }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [verificationMode, setVerificationMode] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationFallbackCode, setVerificationFallbackCode] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);

  const emailStatus = useMemo(() => {
    if (!email) return 'Escribe tu correo institucional o personal';
    return /\S+@\S+\.\S+/.test(email) ? 'Correo listo para autenticarse' : 'Formato de correo invalido';
  }, [email]);
  const normalizedVerificationCode = verificationCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(apiUrl('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await parseResponse(response);

      if (response.ok) {
        if (data && typeof data === 'object') {
          localStorage.setItem('token', (data as any).token);
          onLogin((data as any).token, (data as any).user);
        }
        toast.success('Bienvenido de nuevo');
      } else {
        const message = typeof data === 'object' && data !== null && 'error' in data ? (data as any).error : String(data || response.statusText);
        if (data && typeof data === 'object' && (data as any).requiresVerification) {
          setVerificationMode(true);
          setVerificationFallbackCode(typeof (data as any).verificationCode === 'string' ? (data as any).verificationCode : null);
          setVerificationMessage(message || 'Cuenta pendiente de verificacion');
          toast.info(message || 'Cuenta pendiente de verificacion');
        } else {
          toast.error(message || 'Error al iniciar sesion');
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error de conexion';
      console.error('Login error:', error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(apiUrl('/api/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: normalizedVerificationCode }),
      });

      const data = await parseResponse(response);

      if (response.ok) {
        if (data && typeof data === 'object') {
          localStorage.setItem('token', (data as any).token);
          onLogin((data as any).token, (data as any).user);
        }
        toast.success('Cuenta verificada exitosamente');
      } else {
        const message = typeof data === 'object' && data !== null && 'error' in data ? (data as any).error : String(data || response.statusText);
        toast.error(message || 'Error al verificar');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error de conexion';
      console.error('Verify error:', error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06110f] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.24),transparent_24rem),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.16),transparent_28rem),linear-gradient(135deg,#05110f_0%,#071a17_45%,#020605_100%)]" />
      <div className="absolute inset-0 auth-grid opacity-50" />
      <div className="absolute left-[8%] top-[12%] h-28 w-28 rounded-full border border-emerald-300/20 bg-emerald-300/10 blur-2xl" />
      <div className="absolute bottom-[10%] right-[8%] h-40 w-40 rounded-full border border-cyan-300/10 bg-cyan-300/10 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-emerald-100">
            <Radar className="h-4 w-4 text-emerald-300" />
            Nodo de acceso RootFinder
          </div>

          <div className="max-w-2xl">
            <h1 className="text-5xl font-black leading-none text-white sm:text-6xl">
              Entra al laboratorio con una interfaz mas viva.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-emerald-50/72 sm:text-lg">
              Retoma tus calculos, revisa tu historial y vuelve directo a los metodos numericos con una puerta de entrada mas clara y rapida.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, label: 'Acceso seguro', value: 'JWT activo' },
              { icon: Flame, label: 'Sesion agil', value: '1 paso' },
              { icon: Sparkles, label: 'Vista guiada', value: 'Feedback en vivo' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-[1.6rem] border border-white/10 bg-white/6 p-5 shadow-xl backdrop-blur-xl">
                <Icon className="h-5 w-5 text-emerald-300" />
                <p className="mt-6 text-sm font-semibold text-white/70">{label}</p>
                <p className="mt-2 text-xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[2rem] border border-cyan-300/16 bg-black/28 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200/70">Estado del portal</p>
                <p className="mt-2 text-2xl font-black">Listo para autenticar</p>
              </div>
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-right">
                <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">Flujo</p>
                <p className="text-lg font-black text-cyan-100">Login</p>
              </div>
            </div>
            <div className="mt-6 space-y-3 font-mono text-sm text-emerald-100/70">
              <p>1. Validacion local de campos</p>
              <p>2. Solicitud al backend</p>
              <p>3. Token guardado y acceso al panel</p>
            </div>
          </div>
        </section>

        <Card className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#081311]/88 shadow-[0_30px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-emerald-300 via-cyan-300 to-amber-300" />
          <CardContent className="p-0">
            <div className="border-b border-white/8 px-7 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-100/60">
                    {verificationMode ? 'Verificacion' : 'Inicio de sesion'}
                  </p>
                  <h2 className="mt-3 text-3xl font-black text-white">
                    {verificationMode ? 'Confirma tu cuenta' : 'Bienvenido otra vez'}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-emerald-50/65">
                    {verificationMode
                      ? 'Ingresa el codigo reenviado a tu correo para activar el acceso.'
                      : 'Usa tu cuenta para volver a tu historial, tus resultados y el espacio de trabajo numerico.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-300/18 bg-emerald-300/10 p-3">
                  {verificationMode ? <BadgeCheck className="h-5 w-5 text-emerald-300" /> : <LockKeyhole className="h-5 w-5 text-emerald-300" />}
                </div>
              </div>
            </div>

            <div className="px-7 py-7">
              {verificationMode ? (
                <form onSubmit={handleVerify} className="space-y-5">
                  <div className="rounded-[1.4rem] border border-emerald-300/15 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-50/80">
                    {verificationMessage || `Enviamos un nuevo codigo a ${email}. La cuenta existe, pero todavia necesita verificacion.`}
                    {verificationFallbackCode ? (
                      <div className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-300/12 px-4 py-3 font-mono text-2xl font-black tracking-[0.35em] text-amber-100">
                        {verificationFallbackCode}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-code" className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100/72">
                      Codigo de verificacion
                    </Label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-200/55" />
                      <Input
                        id="login-code"
                        type="text"
                        value={normalizedVerificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        required
                        placeholder="ABC123"
                        maxLength={6}
                        className="h-16 rounded-2xl border-white/10 bg-white/6 pl-11 text-center font-mono text-2xl tracking-[0.45em] text-white placeholder:text-white/22 focus:border-emerald-300/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-6 gap-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={index}
                        className={`flex h-12 items-center justify-center rounded-2xl border text-sm font-black transition ${
                          normalizedVerificationCode[index]
                            ? 'border-emerald-300/30 bg-emerald-300/12 text-emerald-200'
                            : 'border-white/10 bg-white/5 text-white/35'
                        }`}
                      >
                        {normalizedVerificationCode[index] || '*'}
                      </div>
                    ))}
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-14 w-full rounded-2xl bg-emerald-300 text-base font-black text-black shadow-lg shadow-emerald-500/20 transition hover:bg-cyan-300"
                  >
                    {loading ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        Verificar y entrar
                        <BadgeCheck className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setVerificationMode(false)}
                    className="inline-flex items-center gap-2 text-sm font-bold text-emerald-200/80 transition hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Volver al login
                  </button>
                </form>
              ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100/72">
                    Correo electronico
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-200/55" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="tu@email.com"
                      className="h-14 rounded-2xl border-white/10 bg-white/6 pl-11 text-base text-white placeholder:text-white/32 focus:border-emerald-300/50"
                    />
                  </div>
                  <p className="text-xs text-emerald-100/55">{emailStatus}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100/72">
                      Contrasena
                    </Label>
                    <span className="text-[11px] font-semibold text-cyan-100/55">Oculta por defecto</span>
                  </div>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-200/55" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="h-14 rounded-2xl border-white/10 bg-white/6 pl-11 pr-12 text-base text-white placeholder:text-white/32 focus:border-cyan-300/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-white/40 transition hover:text-white"
                      aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="rounded-[1.4rem] border border-white/8 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white/72">Estado del formulario</span>
                    <span className="font-bold text-emerald-300">{email && password ? 'Listo para enviar' : 'Completa ambos campos'}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-emerald-300 via-cyan-300 to-amber-300 transition-all duration-300"
                      style={{ width: email && password ? '100%' : email || password ? '56%' : '20%' }}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-14 w-full rounded-2xl bg-emerald-300 text-base font-black text-black shadow-lg shadow-emerald-500/20 transition hover:bg-cyan-300"
                >
                  {loading ? (
                    <>
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando sesion...
                    </>
                  ) : (
                    <>
                      Entrar al laboratorio
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
              )}

              {!verificationMode && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.4rem] border border-emerald-300/12 bg-emerald-300/8 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-100/60">Acceso</p>
                  <p className="mt-2 text-sm text-emerald-50/75">Conserva historial y resultados asociados a tu cuenta.</p>
                </div>
                <div className="rounded-[1.4rem] border border-cyan-300/12 bg-cyan-300/8 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100/60">Continuidad</p>
                  <p className="mt-2 text-sm text-emerald-50/75">Regresa directo a los modulos sin repetir configuracion.</p>
                </div>
              </div>
              )}

              {!verificationMode && (
              <div className="mt-7 text-center text-sm text-white/58">
                No tienes cuenta?{' '}
                <button onClick={onSwitchToRegister} className="font-bold text-emerald-300 transition hover:text-cyan-300">
                  Crea una ahora
                </button>
              </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
