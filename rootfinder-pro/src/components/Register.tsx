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
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldEllipsis,
  UserPlus,
  WandSparkles,
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

interface RegisterProps {
  onRegister: (token: string, user: any) => void;
  onSwitchToLogin: () => void;
}

function getPasswordStrength(password: string) {
  if (password.length >= 10 && /[A-Z]/.test(password) && /\d/.test(password)) {
    return { label: 'Fuerte', width: '100%', color: 'from-emerald-300 to-cyan-300' };
  }

  if (password.length >= 7) {
    return { label: 'Media', width: '68%', color: 'from-amber-300 to-orange-400' };
  }

  return { label: 'Basica', width: password ? '36%' : '12%', color: 'from-rose-300 to-amber-300' };
}

export function Register({ onRegister, onSwitchToLogin }: RegisterProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationMode, setVerificationMode] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationNote, setVerificationNote] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);
  const passwordsMatch = !!confirmPassword && password === confirmPassword;
  const normalizedVerificationCode = verificationCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Las contrasenas no coinciden');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(apiUrl('/api/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await parseResponse(response);

      if (response.ok) {
        setVerificationMode(true);
        if (data && typeof data === 'object') {
          const warning = (data as any).warning;
          const emailError = (data as any).emailError;
          const code = (data as any).verificationCode;

          if (warning && emailError) {
            setVerificationNote(`${warning} ${emailError}`);
          } else if (warning) {
            setVerificationNote(warning);
          }

          if (code) {
            setVerificationNote(`Codigo de verificacion disponible: ${code}`);
            toast.success(`Codigo temporal: ${code}`);
          }
        }
        toast.success('Registro creado. Revisa tu correo para verificar la cuenta.');
      } else {
        const message = typeof data === 'object' && data !== null && 'error' in data ? (data as any).error : String(data || response.statusText);
        toast.error(message || 'Error al registrar');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error de conexion';
      console.error('Register error:', error);
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
          onRegister((data as any).token, (data as any).user);
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
    <div className="relative min-h-screen overflow-hidden bg-[#120b06] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.24),transparent_26rem),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.18),transparent_26rem),linear-gradient(135deg,#140903_0%,#1c1307_40%,#050807_100%)]" />
      <div className="absolute inset-0 auth-grid auth-grid-warm opacity-45" />
      <div className="absolute left-[10%] top-[18%] h-24 w-24 rounded-full bg-amber-300/12 blur-2xl" />
      <div className="absolute bottom-[12%] right-[12%] h-36 w-36 rounded-full bg-emerald-300/10 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.02fr_0.98fr]">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-amber-100">
            <WandSparkles className="h-4 w-4 text-amber-300" />
            Registro interactivo
          </div>

          <div className="max-w-2xl">
            <h1 className="text-5xl font-black leading-none text-white sm:text-6xl">
              Crea tu acceso y verifica tu cuenta sin salir del flujo.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-amber-50/72 sm:text-lg">
              El registro ahora te muestra progreso, validaciones visibles y una fase de verificacion mas limpia para que no se sienta como un formulario plano.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: UserPlus, label: 'Registro', value: verificationMode ? 'Completado' : 'En progreso' },
              { icon: Mail, label: 'Correo', value: verificationMode ? 'Codigo enviado' : 'Pendiente' },
              { icon: BadgeCheck, label: 'Verificacion', value: verificationMode ? 'Esperando codigo' : 'Siguiente paso' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-[1.6rem] border border-white/10 bg-white/6 p-5 shadow-xl backdrop-blur-xl">
                <Icon className="h-5 w-5 text-amber-300" />
                <p className="mt-6 text-sm font-semibold text-white/70">{label}</p>
                <p className="mt-2 text-xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[2rem] border border-amber-300/12 bg-black/28 p-6 shadow-2xl backdrop-blur-xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-100/70">Ruta del usuario</p>
            <div className="mt-5 flex items-center gap-3 text-sm font-mono text-white/75">
              <span className={`rounded-full px-3 py-2 ${verificationMode ? 'bg-emerald-300/16 text-emerald-200' : 'bg-amber-300/16 text-amber-200'}`}>01 Crear cuenta</span>
              <ArrowRight className="h-4 w-4 text-white/35" />
              <span className={`rounded-full px-3 py-2 ${verificationMode ? 'bg-amber-300/16 text-amber-200' : 'bg-white/8 text-white/45'}`}>02 Verificar codigo</span>
              <ArrowRight className="h-4 w-4 text-white/35" />
              <span className="rounded-full bg-white/8 px-3 py-2 text-white/45">03 Entrar al panel</span>
            </div>
          </div>
        </section>

        <Card className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#16100a]/88 shadow-[0_30px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-amber-300 via-orange-300 to-emerald-300" />
          <CardContent className="p-0">
            <div className="border-b border-white/8 px-7 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-100/60">
                    {verificationMode ? 'Verificacion' : 'Crear cuenta'}
                  </p>
                  <h2 className="mt-3 text-3xl font-black text-white">
                    {verificationMode ? 'Activa tu acceso' : 'Abre tu espacio de trabajo'}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-amber-50/65">
                    {verificationMode
                      ? 'Ingresa el codigo recibido para desbloquear el panel completo.'
                      : 'Configura tus credenciales y pasa a la fase de validacion por correo.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-300/18 bg-amber-300/10 p-3">
                  {verificationMode ? <ShieldEllipsis className="h-5 w-5 text-amber-300" /> : <UserPlus className="h-5 w-5 text-amber-300" />}
                </div>
              </div>
            </div>

            <div className="px-7 py-7">
              {verificationMode ? (
                <form onSubmit={handleVerify} className="space-y-5">
                  {verificationNote ? (
                    <div className="rounded-[1.4rem] border border-amber-300/15 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50/80">
                      {verificationNote}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="code" className="text-xs font-bold uppercase tracking-[0.18em] text-amber-100/72">
                      Codigo de verificacion
                    </Label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200/55" />
                      <Input
                        id="code"
                        type="text"
                        value={normalizedVerificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        required
                        placeholder="ABC123"
                        maxLength={6}
                        className="h-16 rounded-2xl border-white/10 bg-white/6 pl-11 text-center font-mono text-2xl tracking-[0.45em] text-white placeholder:text-white/22 focus:border-amber-300/50"
                      />
                    </div>
                    <p className="text-xs text-amber-100/55">Escribe el codigo tal como llego en tu correo.</p>
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
                        {normalizedVerificationCode[index] || '•'}
                      </div>
                    ))}
                  </div>

                  <Button
                    type="submit"
                    className="h-14 w-full rounded-2xl bg-amber-300 text-base font-black text-black shadow-lg shadow-amber-500/20 transition hover:bg-emerald-300"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        Verificar cuenta
                        <BadgeCheck className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setVerificationMode(false)}
                    className="inline-flex items-center gap-2 text-sm font-bold text-amber-200/80 transition hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Volver al registro
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-bold uppercase tracking-[0.18em] text-amber-100/72">
                      Correo electronico
                    </Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200/55" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="tu@email.com"
                        className="h-14 rounded-2xl border-white/10 bg-white/6 pl-11 text-base text-white placeholder:text-white/32 focus:border-amber-300/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs font-bold uppercase tracking-[0.18em] text-amber-100/72">
                        Contrasena
                      </Label>
                      <span className="text-[11px] font-semibold text-amber-100/55">{passwordStrength.label}</span>
                    </div>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200/55" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        minLength={6}
                        className="h-14 rounded-2xl border-white/10 bg-white/6 pl-11 pr-12 text-base text-white placeholder:text-white/32 focus:border-amber-300/50"
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
                    <div className="h-2 overflow-hidden rounded-full bg-white/8">
                      <div className={`h-full rounded-full bg-linear-to-r ${passwordStrength.color} transition-all duration-300`} style={{ width: passwordStrength.width }} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-[0.18em] text-amber-100/72">
                      Confirmar contrasena
                    </Label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200/55" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="h-14 rounded-2xl border-white/10 bg-white/6 pl-11 pr-12 text-base text-white placeholder:text-white/32 focus:border-emerald-300/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-white/40 transition hover:text-white"
                        aria-label={showConfirmPassword ? 'Ocultar confirmacion' : 'Mostrar confirmacion'}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className={`text-xs ${confirmPassword ? (passwordsMatch ? 'text-emerald-300' : 'text-rose-300') : 'text-amber-100/55'}`}>
                      {confirmPassword ? (passwordsMatch ? 'Las contrasenas coinciden' : 'Las contrasenas no coinciden') : 'Repite tu contrasena para confirmar'}
                    </p>
                  </div>

                  <div className="rounded-[1.4rem] border border-white/8 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-white/72">Progreso del alta</span>
                      <span className="font-bold text-amber-300">
                        {email && password && passwordsMatch ? 'Listo para crear cuenta' : 'Completa los datos'}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-amber-300 via-orange-300 to-emerald-300 transition-all duration-300"
                        style={{ width: email && password && passwordsMatch ? '100%' : email && password ? '70%' : email || password ? '42%' : '18%' }}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="h-14 w-full rounded-2xl bg-amber-300 text-base font-black text-black shadow-lg shadow-amber-500/20 transition hover:bg-emerald-300"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Creando cuenta...
                      </>
                    ) : (
                      <>
                        Crear cuenta
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}

              {!verificationMode && (
                <div className="mt-7 text-center text-sm text-white/58">
                  Ya tienes cuenta?{' '}
                  <button onClick={onSwitchToLogin} className="font-bold text-amber-300 transition hover:text-emerald-300">
                    Inicia sesion
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
