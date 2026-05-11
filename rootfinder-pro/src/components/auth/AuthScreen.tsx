import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, BadgeCheck, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ApiClientError } from '@/lib/apiClient';

type AuthMode = 'login' | 'register' | 'verify';

interface VerificationPayload {
  email: string;
  message: string;
  fallbackCode?: string | null;
}

/**
 * Pantalla de acceso integrada con el store de autenticación y verificación por correo.
 */
export function AuthScreen() {
  const { login, register, verifyEmail, isLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verification, setVerification] = useState<VerificationPayload | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const normalizedVerificationCode = verificationCode.toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 6);

  const header = useMemo(() => {
    if (mode === 'register') {
      return {
        eyebrow: 'Crear cuenta',
        title: 'Abre tu espacio de trabajo',
        description: 'Registro con verificación por correo y sesión segura por refresh token.',
      };
    }

    if (mode === 'verify') {
      return {
        eyebrow: 'Verificar cuenta',
        title: 'Confirma tu acceso',
        description: 'Ingresa el código enviado a tu correo para completar la autenticación.',
      };
    }

    return {
      eyebrow: 'Iniciar sesión',
      title: 'Entra al laboratorio',
      description: 'Accede a tus cálculos, historial y módulos matemáticos desde una sesión segura.',
    };
  }, [mode]);

  const openVerification = (payload: VerificationPayload) => {
    setVerification(payload);
    setVerificationCode('');
    setMode('verify');
  };

  const handleLogin = async (event: { preventDefault: () => void }) => {
    event.preventDefault();

    try {
      await login({ email, password });
      toast.success('Sesión iniciada');
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        error.payload &&
        typeof error.payload === 'object' &&
        'requiresVerification' in error.payload &&
        'email' in error.payload &&
        'error' in error.payload
      ) {
        const payload = error.payload as unknown as {
          email: string;
          error: string;
          verificationCode?: string | null;
        };
        openVerification({
          email: payload.email,
          message: payload.error,
          fallbackCode: payload.verificationCode ?? null,
        });
        toast.error(payload.error);
        return;
      }

      toast.error(error instanceof Error ? error.message : 'No se pudo iniciar sesión');
    }
  };

  const handleRegister = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (passwordMismatch) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    try {
      const response = await register({ username, email, password, confirmPassword });
      openVerification({
        email: response.email,
        message: response.emailSent
          ? 'Revisa tu correo y usa el código de verificación.'
          : response.emailError || 'No se pudo enviar el correo; usa el código mostrado.',
        fallbackCode: response.verificationCode ?? null,
      });
      toast.success('Cuenta creada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la cuenta');
    }
  };

  const handleVerify = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!verification) {
      return;
    }

    try {
      await verifyEmail({ email: verification.email, code: normalizedVerificationCode });
      toast.success('Cuenta verificada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo verificar la cuenta');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-4 py-8 text-[var(--text-primary)]">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <p className="inline-flex rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            RootFinder Pro
          </p>
          <div>
            <h1 className="max-w-3xl text-5xl font-extrabold leading-none">
              Ingeniería numérica con una base más limpia.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[var(--text-muted)]">
              La sesión ahora vive con `accessToken` en memoria, refresh seguro por cookie y validación
              alineada con el backend refactorizado.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              'Historial remoto como fuente única',
              'Verificación de correo integrada',
              'Arquitectura lista para módulos nuevos',
            ].map((item) => (
              <div key={item} className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-muted)]">
                {item}
              </div>
            ))}
          </div>
        </section>

        <Card className="overflow-hidden rounded-[2rem] border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl">
          <CardContent className="p-0">
            <div className="border-b border-[var(--border)] px-7 py-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {header.eyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-extrabold">{header.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{header.description}</p>
            </div>

            <div className="px-7 py-7">
              {mode === 'verify' ? (
                <form onSubmit={handleVerify} className="space-y-5">
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-sm text-[var(--text-muted)]">
                    <p>{verification?.message}</p>
                    {verification?.fallbackCode ? (
                      <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 font-mono text-2xl font-extrabold tracking-[0.28em] text-amber-200">
                        {verification.fallbackCode}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="verification-code">Código de verificación</Label>
                    <Input
                      id="verification-code"
                      value={normalizedVerificationCode}
                      onChange={(event) => setVerificationCode(event.target.value)}
                      maxLength={6}
                      className="h-14 rounded-2xl border-[var(--border)] bg-[var(--bg-elevated)] text-center font-mono text-2xl tracking-[0.28em]"
                    />
                  </div>

                  <Button type="submit" disabled={isLoading} className="h-14 w-full rounded-2xl">
                    {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                    Verificar y entrar
                  </Button>

                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    Volver al inicio de sesión
                  </button>
                </form>
              ) : mode === 'register' ? (
                <form onSubmit={handleRegister} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Nombre de usuario</Label>
                    <div className="relative">
                      <UserPlus className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                      <Input
                        id="register-username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        className="h-12 rounded-2xl border-[var(--border)] bg-[var(--bg-elevated)] pl-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">Correo electrónico</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                      <Input
                        id="register-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="h-12 rounded-2xl border-[var(--border)] bg-[var(--bg-elevated)] pl-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password">Contraseña</Label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                      <Input
                        id="register-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="h-12 rounded-2xl border-[var(--border)] bg-[var(--bg-elevated)] pl-11 pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[var(--text-muted)]"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-confirm">Confirmar contraseña</Label>
                    <Input
                      id="register-confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="h-12 rounded-2xl border-[var(--border)] bg-[var(--bg-elevated)]"
                    />
                    {passwordMismatch ? (
                      <p className="text-xs text-[var(--destructive)]">Las contraseñas no coinciden.</p>
                    ) : null}
                  </div>

                  <Button type="submit" disabled={isLoading} className="h-14 w-full rounded-2xl">
                    {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Crear cuenta
                  </Button>

                  <p className="text-center text-sm text-[var(--text-muted)]">
                    ¿Ya tienes cuenta?{' '}
                    <button type="button" onClick={() => setMode('login')} className="font-semibold text-[var(--primary)]">
                      Inicia sesión
                    </button>
                  </p>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Correo electrónico</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                      <Input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="h-12 rounded-2xl border-[var(--border)] bg-[var(--bg-elevated)] pl-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="h-12 rounded-2xl border-[var(--border)] bg-[var(--bg-elevated)] pl-11 pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[var(--text-muted)]"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" disabled={isLoading} className="h-14 w-full rounded-2xl">
                    {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Ingresar
                  </Button>

                  <p className="text-center text-sm text-[var(--text-muted)]">
                    ¿No tienes cuenta?{' '}
                    <button type="button" onClick={() => setMode('register')} className="font-semibold text-[var(--primary)]">
                      Regístrate
                    </button>
                  </p>
                </form>
              )}

              <div className="mt-6 flex items-start gap-3 rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-sm text-[var(--text-muted)]">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--accent-amber)]" />
                El acceso usa `httpOnly` cookie para refresh y token en memoria para las solicitudes activas.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
