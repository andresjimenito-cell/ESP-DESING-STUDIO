import React, {
    useState,
    useEffect,
    useMemo,
    useCallback,
    useRef,
} from 'react';
import {
    Shield,
    Lock,
    Mail,
    Eye,
    EyeOff,
    AlertTriangle,
    Loader2,
    CheckCircle2,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_KEY = 'esp_session_token';
const SESSION_EMAIL_KEY = 'esp_session_email';

const CORPORATE_DOMAIN = '@fronteraenergy.ca';
const DEMO_EMAIL = `correo${CORPORATE_DOMAIN}`;
const DEMO_PASSWORD = '2026';

const PARTICLE_COUNT = 25;
const MOUSE_TILT_FACTOR = 0.2;
const MOUSE_THROTTLE_MS = 30;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Session helpers ───────────────────────────────────────────────────────────

export const getSessionToken = (): string | null => sessionStorage.getItem(SESSION_KEY);
export const getSessionEmail = (): string | null => sessionStorage.getItem(SESSION_EMAIL_KEY);

export const clearSession = (): void => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_EMAIL_KEY);
};

export const isSessionValid = (): boolean => {
    const token = getSessionToken();
    if (!token) return false;

    const parts = token.split('.');
    if (parts.length !== 2) {
        clearSession();
        return false;
    }

    try {
        const payload = JSON.parse(atob(parts[0]));

        const expiredOrMissing = !payload.exp || payload.exp < Date.now();
        const wrongDomain = !payload.email?.toLowerCase().endsWith(CORPORATE_DOMAIN);

        if (expiredOrMissing || wrongDomain) {
            clearSession();
            return false;
        }

        return true;
    } catch {
        clearSession();
        return false;
    }
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoginProps {
    onLoginSuccess: () => void;
}

interface FieldErrors {
    email?: string;
    password?: string;
}

interface Particle {
    id: number;
    x: number;
    y: number;
    size: number;
    speed: number;
    drift: number;
    delay: number;
    opacity: number;
    color: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const PARTICLE_COLORS = [
    'var(--color-primary)',
    'var(--color-secondary)',
    'var(--color-accent)',
];

const ParticleField: React.FC<{ particles: Particle[] }> = ({ particles }) => (
    <>
        {particles.map(p => (
            <div
                key={p.id}
                className="absolute rounded-full"
                style={{
                    left: `${p.x}%`,
                    bottom: '-8px',
                    width: p.size,
                    height: p.size,
                    background: `rgb(${p.color})`,
                    boxShadow: `0 0 4px rgb(${p.color})`,
                    '--op': p.opacity,
                    '--drift': `${p.drift}px`,
                    animation: `login-particle-rise ${p.speed}s linear ${p.delay}s infinite`,
                    opacity: 0,
                } as React.CSSProperties}
            />
        ))}
    </>
);

const AuroraBg: React.FC = () => (
    <>
        <div
            className="absolute top-[-15%] left-[-15%] w-[450px] h-[450px] rounded-full opacity-35"
            style={{
                background: 'radial-gradient(circle, rgba(var(--color-primary), 0.25) 0%, transparent 70%)',
                filter: 'blur(90px)',
                animation: 'login-aurora-glow-1 12s ease-in-out infinite',
            }}
        />
        <div
            className="absolute bottom-[-15%] right-[-15%] w-[450px] h-[450px] rounded-full opacity-25"
            style={{
                background: 'radial-gradient(circle, rgba(var(--color-secondary), 0.2) 0%, transparent 70%)',
                filter: 'blur(90px)',
                animation: 'login-aurora-glow-2 15s ease-in-out infinite',
            }}
        />
    </>
);

const OrbitalRings: React.FC = () => (
    <>
        {/* Outer halo */}
        <div style={{
            position: 'absolute',
            inset: -25,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(var(--color-primary), 0.12) 0%, transparent 65%)',
            animation: 'login-halo-pulse 5s ease-in-out infinite',
        }} />
        {/* Ring 1 — clockwise */}
        <div style={{
            position: 'absolute',
            inset: -8,
            border: '1px solid rgba(var(--color-primary), 0.15)',
            borderRadius: '50%',
            animation: 'login-ring-cw 18s linear infinite',
        }}>
            <div style={{
                position: 'absolute',
                top: -2.5,
                left: '50%',
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: 'rgb(var(--color-primary))',
                boxShadow: '0 0 10px rgb(var(--color-primary)), 0 0 20px rgb(var(--color-primary))',
                transform: 'translateX(-50%)',
            }} />
        </div>
        {/* Ring 2 — counter-clockwise / tilted */}
        <div style={{
            position: 'absolute',
            inset: -18,
            border: '0.5px solid rgba(var(--color-secondary), 0.1)',
            borderRadius: '50%',
            animation: 'login-ring-ccw 30s linear infinite',
            transform: 'rotate3d(1, 0.5, 0, 50deg)',
        }}>
            <div style={{
                position: 'absolute',
                bottom: -2,
                right: '30%',
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'rgb(var(--color-secondary))',
                boxShadow: '0 0 8px rgb(var(--color-secondary))',
            }} />
        </div>
    </>
);

// ─── Inline styles (extracted to avoid JSX noise) ─────────────────────────────

const ANIMATIONS = `
  @keyframes login-particle-rise {
    0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
    5%   { opacity: var(--op); }
    95%  { opacity: calc(var(--op) * 0.5); }
    100% { transform: translateY(-80vh) translateX(var(--drift)) scale(0.4); opacity: 0; }
  }
  @keyframes login-glow-pulse {
    0%, 100% { box-shadow: 0 20px 50px rgba(0,0,0,.45), 0 0 50px rgba(var(--color-primary),.05), inset 0 1px 0 rgba(255,255,255,.04); }
    50%       { box-shadow: 0 30px 60px rgba(0,0,0,.55), 0 0 80px rgba(var(--color-primary),.16), inset 0 1px 0 rgba(255,255,255,.06); }
  }
  @keyframes login-ring-cw  { to { transform: rotate(360deg); } }
  @keyframes login-ring-ccw { to { transform: rotate(-360deg); } }
  @keyframes login-logo-illuminate {
    0%, 100% { filter: brightness(1) drop-shadow(0 0 12px rgba(var(--color-primary),.3)); }
    50%       { filter: brightness(1.2) drop-shadow(0 0 28px rgba(var(--color-primary),.6)); }
  }
  @keyframes login-sweep {
    0%   { top: -4px; opacity: 0; }
    5%   { opacity: 1; }
    92%  { opacity: .5; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes login-shake {
    0%, 100%              { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
    20%, 40%, 60%, 80%    { transform: translateX(4px); }
  }
  @keyframes login-halo-pulse {
    0%, 100% { transform: scale(1);    opacity: .15; }
    50%       { transform: scale(1.15); opacity: .35; }
  }
  @keyframes login-scanline {
    0%   { transform: translateY(-100%); opacity: 0; }
    10%  { opacity: .04; }
    90%  { opacity: .02; }
    100% { transform: translateY(100%); opacity: 0; }
  }
  @keyframes login-aurora-glow-1 {
    0%, 100% { transform: translate(0,0) scale(1); }
    50%       { transform: translate(30px,-20px) scale(1.1); }
  }
  @keyframes login-aurora-glow-2 {
    0%, 100% { transform: translate(0,0) scale(1.1); }
    50%       { transform: translate(-20px,30px) scale(.95); }
  }
  @keyframes login-sheen {
    0%   { transform: translateX(-150%) skewX(-15deg); }
    100% { transform: translateX(250%) skewX(-15deg); }
  }
  @keyframes login-pulse-green {
    0%, 100% { opacity: .4; }
    50%       { opacity: 1; transform: scale(1.2); }
  }

  .login-card {
    background:       rgba(11,18,32,.5) !important;
    backdrop-filter:  blur(40px) saturate(220%) !important;
    border:           1px solid rgba(var(--color-primary),.15) !important;
    transition:       border-color .4s ease, box-shadow .4s ease !important;
  }
  .login-card:hover { border-color: rgba(var(--color-primary),.35) !important; }

  .input-premium:focus-within {
    border-color: rgba(var(--color-primary),.5) !important;
    box-shadow:   0 0 20px rgba(var(--color-primary),.12), inset 0 0 10px rgba(var(--color-primary),.05) !important;
    background:   rgba(var(--color-canvas),.7) !important;
  }
  .btn-premium::after {
    content:        '';
    position:       absolute;
    top:0; left:0;
    width:60%; height:100%;
    background:     linear-gradient(90deg, transparent, rgba(255,255,255,.24), transparent);
    transform:      translateX(-150%) skewX(-15deg);
    pointer-events: none;
  }
  .btn-premium:hover::after { animation: login-sheen 1.8s infinite; }
`;

// ─── Main component ───────────────────────────────────────────────────────────

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [loading, setLoading] = useState(false);
    const [quickFilled, setQuickFilled] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [mounted, setMounted] = useState(false);

    const lastMouseTime = useRef(0);

    // Mount animation
    useEffect(() => {
        const id = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(id);
    }, []);

    // Throttled mouse-tilt effect
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const now = Date.now();
            if (now - lastMouseTime.current < MOUSE_THROTTLE_MS) return;
            lastMouseTime.current = now;

            setMousePos({
                x: (e.clientX / window.innerWidth - 0.5) * 15,
                y: (e.clientY / window.innerHeight - 0.5) * 15,
            });
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Stable particle data — never recreated
    const fieldParticles = useMemo<Particle[]>(() =>
        Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: 1 + Math.random() * 3,
            speed: 25 + Math.random() * 50,
            drift: (Math.random() - 0.5) * 30,
            delay: Math.random() * -25,
            opacity: 0.15 + Math.random() * 0.45,
            color: PARTICLE_COLORS[i % 3],
        })),
        []);

    // Field-level validation (client-side)
    const validateFields = useCallback((): boolean => {
        const errs: FieldErrors = {};

        if (!EMAIL_REGEX.test(email.trim())) {
            errs.email = 'Ingresa un correo válido.';
        } else if (!email.trim().toLowerCase().endsWith(CORPORATE_DOMAIN)) {
            errs.email = `El correo debe ser de ${CORPORATE_DOMAIN}`;
        }

        if (password.length < 3) {
            errs.password = 'La contraseña es demasiado corta.';
        }

        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    }, [email, password]);

    const clearErrors = useCallback(() => {
        setError('');
        setFieldErrors({});
    }, []);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        clearErrors();

        if (!validateFields()) return;

        setLoading(true);

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error ?? 'No tienes acceso a archivos privados de la organización.');
                return;
            }

            const data = await res.json();

            if (data.token) {
                sessionStorage.setItem(SESSION_KEY, data.token);
                sessionStorage.setItem(SESSION_EMAIL_KEY, email.trim().toLowerCase());
                onLoginSuccess();
            } else {
                setError('No tienes acceso a archivos privados de la organización.');
            }
        } catch {
            setError('Error de conexión. Verifica tu red e intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    }, [email, password, clearErrors, validateFields, onLoginSuccess]);

    const handleQuickFill = useCallback(() => {
        setEmail(DEMO_EMAIL);
        setPassword(DEMO_PASSWORD);
        clearErrors();
        setQuickFilled(true);
        setTimeout(() => setQuickFilled(false), 2000);
    }, [clearErrors]);

    const toggleShowPassword = useCallback(() => setShowPassword(v => !v), []);

    const cardTransform = mounted
        ? `perspective(1200px) rotateY(${mousePos.x * MOUSE_TILT_FACTOR}deg) rotateX(${-mousePos.y * MOUSE_TILT_FACTOR}deg)`
        : 'translateY(30px) scale(0.97)';

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden font-sans"
            style={{
                backgroundColor: 'rgb(var(--color-canvas))',
                backgroundImage: 'linear-gradient(rgb(var(--color-canvas) / 0.82), rgb(var(--color-canvas) / 0.88)), url(/main_bg.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            <style>{ANIMATIONS}</style>

            {/* ── BACKGROUND ── */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Dot grid */}
                <div
                    className="absolute inset-0 opacity-15"
                    style={{
                        backgroundImage: 'radial-gradient(circle, rgba(var(--color-primary), 0.15) 1.2px, transparent 1.2px)',
                        backgroundSize: '24px 24px',
                        maskImage: 'radial-gradient(circle at center, black 40%, transparent 95%)',
                    }}
                />

                <AuroraBg />
                <ParticleField particles={fieldParticles} />

                {/* Scanline sweep */}
                <div style={{
                    position: 'absolute',
                    left: 0, right: 0,
                    height: '30%',
                    background: 'linear-gradient(to bottom, transparent, rgba(var(--color-primary), 0.02), transparent)',
                    animation: 'login-scanline 9s linear infinite',
                }} />
            </div>

            {/* ── CARD ── */}
            <div
                role="main"
                aria-label="Inicio de sesión ESP Design Studio"
                style={{
                    opacity: mounted ? 1 : 0,
                    transform: cardTransform,
                    transition: 'opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.18s ease-out',
                    animation: mounted ? 'login-glow-pulse 6s ease-in-out infinite' : 'none',
                }}
                className="relative z-10 w-full max-w-[420px] mx-4 max-h-[92vh] overflow-y-auto custom-scrollbar login-card"
            >
                {/* Accent bar */}
                <div className="h-1.5 w-full shrink-0" style={{
                    background: 'linear-gradient(90deg, rgba(var(--color-primary),.9), rgba(var(--color-secondary),.7), rgba(var(--color-primary),.9))',
                }} />

                <div className="px-9 pt-9 pb-9 flex flex-col">

                    {/* ── LOGO ── */}
                    <div className="flex flex-col items-center mb-8 shrink-0">
                        <div style={{ position: 'relative', width: 110, height: 110 }}>
                            <OrbitalRings />

                            <div style={{
                                position: 'relative',
                                width: '100%',
                                height: '100%',
                                animation: 'login-logo-illuminate 4s ease-in-out infinite',
                            }}>
                                <img
                                    src="/LOGO.png"
                                    alt="ESP Design Studio"
                                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                                />
                                {/* Logo sweep line */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0, left: -6, right: -6,
                                    height: '2px',
                                    background: 'linear-gradient(90deg, transparent, rgba(var(--color-secondary),.9), transparent)',
                                    boxShadow: '0 0 12px rgba(var(--color-secondary),.8)',
                                    animation: 'login-sweep 3.5s ease-in-out infinite',
                                }} />
                            </div>
                        </div>

                        <div className="mt-5 text-center">
                            <h1 className="text-2xl font-black tracking-tight text-txt-main leading-none uppercase">
                                ESP DESIGN <span style={{ color: 'rgb(var(--color-primary))' }}>STUDIO</span>
                            </h1>
                            <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.35em]"
                                style={{ color: 'rgba(var(--color-primary), 0.65)' }}>
                                FRONTERA ENERGY — PLATAFORMA PRIVADA
                            </p>
                        </div>
                    </div>

                    {/* ── SECURITY BADGE ── */}
                    <div className="flex items-center justify-center gap-2 mb-6 shrink-0">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{
                            background: 'rgba(var(--color-primary), 0.08)',
                            border: '1px solid rgba(var(--color-primary), 0.16)',
                        }}>
                            <Shield className="w-3.5 h-3.5" style={{ color: 'rgb(var(--color-primary))' }} />
                            <span className="text-[8px] font-black uppercase tracking-[0.25em]"
                                style={{ color: 'rgba(var(--color-primary), 0.8)' }}>
                                ACCESO CIFRADO · HMAC-SHA256
                            </span>
                        </div>
                    </div>

                    {/* ── FORM ── */}
                    <form onSubmit={handleSubmit} noValidate className="space-y-4">

                        {/* Email field */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="login-email"
                                className="text-[9px] font-black uppercase tracking-[0.2em] text-txt-muted flex items-center justify-between"
                            >
                                <span className="flex items-center gap-2">
                                    <Mail className="w-3 h-3 text-primary" aria-hidden />
                                    Correo Corporativo
                                </span>
                                <span
                                    className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                                    style={{
                                        background: email ? 'rgb(var(--color-primary))' : 'rgba(255,255,255,.15)',
                                        boxShadow: email ? '0 0 8px rgb(var(--color-primary))' : 'none',
                                    }}
                                />
                            </label>

                            <div className={`relative input-premium rounded-xl ${fieldErrors.email ? 'ring-1 ring-red-500/50' : ''}`}>
                                <input
                                    id="login-email"
                                    type="email"
                                    value={email}
                                    onChange={e => { setEmail(e.target.value); clearErrors(); }}
                                    placeholder={DEMO_EMAIL}
                                    required
                                    autoComplete="email"
                                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                                    aria-invalid={!!fieldErrors.email}
                                    className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-txt-main placeholder:text-txt-muted/20 outline-none transition-all duration-300"
                                    style={{
                                        background: 'rgba(var(--color-canvas), .45)',
                                        border: '1px solid rgba(var(--color-primary), .15)',
                                    }}
                                />
                            </div>

                            {fieldErrors.email && (
                                <p id="email-error" className="text-[10px] text-red-400 font-semibold pl-1">
                                    {fieldErrors.email}
                                </p>
                            )}
                        </div>

                        {/* Password field */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="login-password"
                                className="text-[9px] font-black uppercase tracking-[0.2em] text-txt-muted flex items-center justify-between"
                            >
                                <span className="flex items-center gap-2">
                                    <Lock className="w-3 h-3 text-primary" aria-hidden />
                                    Contraseña
                                </span>
                                <span
                                    className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                                    style={{
                                        background: password ? 'rgb(var(--color-primary))' : 'rgba(255,255,255,.15)',
                                        boxShadow: password ? '0 0 8px rgb(var(--color-primary))' : 'none',
                                    }}
                                />
                            </label>

                            <div className={`relative input-premium rounded-xl ${fieldErrors.password ? 'ring-1 ring-red-500/50' : ''}`}>
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); clearErrors(); }}
                                    placeholder="••••••••••"
                                    required
                                    autoComplete="current-password"
                                    aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                                    aria-invalid={!!fieldErrors.password}
                                    className="w-full px-4 py-3 pr-12 rounded-xl text-sm font-semibold text-txt-main placeholder:text-txt-muted/20 outline-none transition-all duration-300"
                                    style={{
                                        background: 'rgba(var(--color-canvas), .45)',
                                        border: '1px solid rgba(var(--color-primary), .15)',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={toggleShowPassword}
                                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all hover:bg-white/5"
                                >
                                    {showPassword
                                        ? <EyeOff className="w-4 h-4 text-txt-muted hover:text-white" aria-hidden />
                                        : <Eye className="w-4 h-4 text-txt-muted hover:text-white" aria-hidden />}
                                </button>
                            </div>

                            {fieldErrors.password && (
                                <p id="password-error" className="text-[10px] text-red-400 font-semibold pl-1">
                                    {fieldErrors.password}
                                </p>
                            )}
                        </div>

                        {/* Global error */}
                        {error && (
                            <div
                                role="alert"
                                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                                style={{
                                    background: 'rgba(239,68,68,.08)',
                                    border: '1px solid rgba(239,68,68,.25)',
                                    animation: 'login-shake .5s ease-in-out',
                                }}
                            >
                                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" aria-hidden />
                                <span className="text-[11px] font-bold text-red-400/90">{error}</span>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            id="login-submit"
                            type="submit"
                            disabled={loading || !email || !password}
                            aria-busy={loading}
                            className="w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-[0.22em] transition-all duration-500 relative overflow-hidden group disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] btn-premium mt-2"
                            style={{
                                background: loading
                                    ? 'rgba(var(--color-primary), .25)'
                                    : 'linear-gradient(135deg, rgb(var(--color-primary)), rgb(var(--color-secondary)))',
                                color: 'white',
                                boxShadow: '0 4px 24px rgba(var(--color-primary),.28), inset 0 1px 0 rgba(255,255,255,.15)',
                                border: '1px solid rgba(var(--color-primary),.2)',
                            }}
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3">
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                                        Verificando…
                                    </>
                                ) : (
                                    <>
                                        <Shield className="w-4 h-4 transition-transform group-hover:scale-110" aria-hidden />
                                        Iniciar Sesión
                                    </>
                                )}
                            </span>
                        </button>
                    </form>

                    {/* ── DEMO CREDENTIALS TERMINAL ── */}
                    <div
                        onClick={handleQuickFill}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && handleQuickFill()}
                        aria-label="Autocompletar credenciales de demo"
                        className="mt-5 p-3.5 rounded-xl border border-white/5 font-mono text-[10px] cursor-pointer group/term hover:border-primary/30 transition-all duration-300 select-none shrink-0"
                        style={{ background: 'rgba(var(--color-canvas), .45)' }}
                    >
                        <div className="flex items-center justify-between mb-1.5 border-b border-white/5 pb-1 opacity-70">
                            <span className="text-[8px] font-black uppercase text-txt-muted tracking-wider flex items-center gap-1.5">
                                <span
                                    className="w-1.5 h-1.5 rounded-full bg-primary"
                                    style={{ animation: 'login-pulse-green 1.5s infinite' }}
                                />
                                Terminal: Credenciales Demo
                            </span>

                            <span className="text-[8px] font-bold text-primary flex items-center gap-1 group-hover/term:underline">
                                {quickFilled ? (
                                    <><CheckCircle2 className="w-3 h-3" aria-hidden /> Completado</>
                                ) : (
                                    'Click para autocompletar'
                                )}
                            </span>
                        </div>

                        <div className="space-y-0.5 text-txt-muted/80">
                            <div><span style={{ color: 'rgb(var(--color-primary))' }}>CORREO:</span> {DEMO_EMAIL}</div>
                            <div><span style={{ color: 'rgb(var(--color-primary))' }}>CLAVE:</span> {DEMO_PASSWORD}</div>
                        </div>
                    </div>
                </div>

                {/* ── FOOTER ── */}
                <div
                    className="px-9 py-4 flex items-center justify-between shrink-0"
                    style={{
                        borderTop: '1px solid rgba(var(--color-primary), .08)',
                        background: 'rgba(var(--color-canvas), .4)',
                    }}
                >
                    <span className="text-[7px] font-black uppercase tracking-[0.25em] flex items-center gap-1.5"
                        style={{ color: 'rgba(var(--color-primary), .3)' }}>
                        <span
                            className="w-1 h-1 rounded-full bg-green-400"
                            style={{ animation: 'login-pulse-green 1s infinite' }}
                            aria-hidden
                        />
                        SSL SECURE
                    </span>
                    <span className="text-[7px] font-black uppercase tracking-[0.25em]"
                        style={{ color: 'rgba(var(--color-primary), .3)' }}>
                        ENCRYPTED SESSION
                    </span>
                    <span className="text-[7px] font-black uppercase tracking-[0.25em]"
                        style={{ color: 'rgba(var(--color-primary), .3)' }}>
                        AJM © 2026
                    </span>
                </div>
            </div>
        </div>
    );
};