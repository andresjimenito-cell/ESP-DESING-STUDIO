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
    Users,
    Cpu,
    Zap,
    Heart
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_KEY = 'esp_session_token';
const SESSION_EMAIL_KEY = 'esp_session_email';

const PARTICLE_COUNT = 30;
const MOUSE_TILT_FACTOR = 0.15;
const MOUSE_THROTTLE_MS = 25;

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

        if (expiredOrMissing) {
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
                className="absolute rounded-full pointer-events-none"
                style={{
                    left: `${p.x}%`,
                    bottom: '-8px',
                    width: p.size,
                    height: p.size,
                    background: `rgb(${p.color})`,
                    boxShadow: `0 0 6px rgb(${p.color})`,
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
            className="absolute top-[-10%] left-[-10%] w-[550px] h-[550px] rounded-full opacity-40 pointer-events-none"
            style={{
                background: 'radial-gradient(circle, rgba(var(--color-primary), 0.3) 0%, transparent 70%)',
                filter: 'blur(100px)',
                animation: 'login-aurora-glow-1 15s ease-in-out infinite',
            }}
        />
        <div
            className="absolute bottom-[-10%] right-[-10%] w-[550px] h-[550px] rounded-full opacity-30 pointer-events-none"
            style={{
                background: 'radial-gradient(circle, rgba(var(--color-secondary), 0.25) 0%, transparent 70%)',
                filter: 'blur(100px)',
                animation: 'login-aurora-glow-2 18s ease-in-out infinite',
            }}
        />
    </>
);

// ─── Inline styles (extracted to avoid JSX noise) ─────────────────────────────

const ANIMATIONS = `
  @keyframes login-particle-rise {
    0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
    5%   { opacity: var(--op); }
    95%  { opacity: calc(var(--op) * 0.5); }
    100% { transform: translateY(-90vh) translateX(var(--drift)) scale(0.3); opacity: 0; }
  }
  @keyframes login-glow-pulse {
    0%, 100% { box-shadow: 0 30px 70px rgba(0,0,0,.65), 0 0 50px rgba(var(--color-primary),.06), inset 0 1px 0 rgba(255,255,255,.05); }
    50%       { box-shadow: 0 40px 90px rgba(0,0,0,.75), 0 0 80px rgba(var(--color-primary),.18), inset 0 1px 0 rgba(255,255,255,.08); }
  }
  @keyframes login-logo-illuminate {
    0%, 100% { filter: brightness(1) drop-shadow(0 0 15px rgba(var(--color-primary),.3)); }
    50%       { filter: brightness(1.25) drop-shadow(0 0 30px rgba(var(--color-primary),.7)); }
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
  @keyframes login-scanline {
    0%   { transform: translateY(-100%); opacity: 0; }
    10%  { opacity: .03; }
    90%  { opacity: .01; }
    100% { transform: translateY(100%); opacity: 0; }
  }
  @keyframes login-aurora-glow-1 {
    0%, 100% { transform: translate(0,0) scale(1); }
    50%       { transform: translate(50px,-30px) scale(1.15); }
  }
  @keyframes login-aurora-glow-2 {
    0%, 100% { transform: translate(0,0) scale(1.15); }
    50%       { transform: translate(-30px,50px) scale(.9); }
  }
  @keyframes login-sheen {
    0%   { transform: translateX(-150%) skewX(-15deg); }
    100% { transform: translateX(250%) skewX(-15deg); }
  }

  .login-card-container {
    background:       rgba(8, 12, 24, 0.65) !important;
    backdrop-filter:  blur(40px) saturate(220%) !important;
    border:           1px solid rgba(var(--color-primary), 0.22) !important;
    transition:       border-color .4s ease, box-shadow .4s ease !important;
  }

  .input-premium {
    border: 1px solid rgba(var(--color-primary), 0.18) !important;
    background: rgba(8, 10, 18, 0.4) !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }
  .input-premium:focus-within {
    border-color: rgb(var(--color-primary)) !important;
    box-shadow:   0 0 25px rgba(var(--color-primary), 0.25), inset 0 0 10px rgba(var(--color-primary), 0.1) !important;
    background:   rgba(8, 10, 18, 0.75) !important;
  }
  .input-premium input {
    background: transparent !important;
    border: none !important;
    color: #ffffff !important;
    outline: none !important;
  }
  .input-premium input::placeholder {
    color: rgba(255, 255, 255, 0.3) !important;
  }

  .btn-premium::after {
    content:        '';
    position:       absolute;
    top:0; left:0;
    width:60%; height:100%;
    background:     linear-gradient(90deg, transparent, rgba(255,255,255,.2), transparent);
    transform:      translateX(-150%) skewX(-15deg);
    pointer-events: none;
  }
  .btn-premium:hover::after { animation: login-sheen 1.8s infinite; }
  
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(var(--color-primary), 0.3);
  }
`;

// ─── Main component ───────────────────────────────────────────────────────────

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [loading, setLoading] = useState(false);
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
                x: (e.clientX / window.innerWidth - 0.5) * 12,
                y: (e.clientY / window.innerHeight - 0.5) * 12,
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
            size: 1.2 + Math.random() * 3,
            speed: 20 + Math.random() * 45,
            drift: (Math.random() - 0.5) * 40,
            delay: Math.random() * -20,
            opacity: 0.2 + Math.random() * 0.5,
            color: PARTICLE_COLORS[i % 3],
        })),
        []);

    // Field-level validation (client-side)
    const validateFields = useCallback((): boolean => {
        const errs: FieldErrors = {};

        if (!EMAIL_REGEX.test(email.trim())) {
            errs.email = 'Ingresa un correo corporativo válido.';
        }

        if (password.length < 1) {
            errs.password = 'Por favor, ingresa tu contraseña.';
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

    const toggleShowPassword = useCallback(() => setShowPassword(v => !v), []);

    const cardTransform = mounted
        ? `perspective(1200px) rotateY(${mousePos.x * MOUSE_TILT_FACTOR}deg) rotateX(${-mousePos.y * MOUSE_TILT_FACTOR}deg)`
        : 'translateY(30px) scale(0.97)';

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden font-sans p-4"
            style={{
                backgroundColor: 'rgb(var(--color-canvas))',
                backgroundImage: 'linear-gradient(to bottom, rgb(var(--color-canvas) / 0.85), rgb(var(--color-canvas) / 0.9)), url(/main_bg.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            <style>{ANIMATIONS}</style>

            {/* ── BACKGROUND EFFECTS ── */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: 'radial-gradient(circle, rgba(var(--color-primary), 0.15) 1.2px, transparent 1.2px)',
                        backgroundSize: '24px 24px',
                        maskImage: 'radial-gradient(circle at center, black 40%, transparent 95%)',
                    }}
                />
                <AuroraBg />
                <ParticleField particles={fieldParticles} />
                <div style={{
                    position: 'absolute',
                    left: 0, right: 0,
                    height: '25%',
                    background: 'linear-gradient(to bottom, transparent, rgba(var(--color-primary), 0.015), transparent)',
                    animation: 'login-scanline 10s linear infinite',
                }} />
            </div>

            {/* ── SPLIT CONTAINER CARD ── */}
            <div
                role="main"
                aria-label="Inicio de sesión ESP Design Studio"
                style={{
                    opacity: mounted ? 1 : 0,
                    transform: cardTransform,
                    transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s ease-out',
                    animation: mounted ? 'login-glow-pulse 8s ease-in-out infinite' : 'none',
                }}
                className="relative z-10 w-full max-w-[880px] rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-[0_30px_90px_rgba(0,0,0,0.8)] login-card-container max-h-[94vh]"
            >
                {/* ── LEFT COLUMN: CREATIVE BLUEPRINT & CREDITS ── */}
                <div className="flex-1 bg-gradient-to-b from-surface/90 to-canvas/95 border-b md:border-b-0 md:border-r border-white/5 p-8 flex flex-col justify-between overflow-y-auto custom-scrollbar min-h-[300px] md:min-h-0">
                    
                    {/* Header/Title details */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 flex items-center justify-center p-1 border border-primary/20 bg-primary/10 rounded-xl relative group">
                                <img
                                    src="/LOGO.png"
                                    alt="Logo"
                                    className="w-full h-full object-contain filter drop-shadow-md brightness-110"
                                />
                                <div className="absolute inset-0 bg-primary/15 scale-0 group-hover:scale-100 transition-all rounded-xl" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black tracking-tight text-white leading-none uppercase">
                                    ESP DESIGN <span className="text-primary font-bold">STUDIO</span>
                                </h1>
                                <p className="text-[7.5px] font-black uppercase tracking-[0.3em] text-primary/60 mt-1">
                                    Engineering Suite
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4 pr-2">
                            <div className="h-[1px] bg-gradient-to-r from-primary/30 to-transparent w-full" />
                            <p className="text-[10px] text-txt-muted uppercase font-bold leading-relaxed tracking-wider">
                                Plataforma privada avanzada para el modelado, simulación y diagnóstico de sistemas de Bombeo Electrosumergible (ESP).
                            </p>
                        </div>
                    </div>

                    {/* CREDITS SYSTEM SECTION */}
                    <div className="mt-8 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Users className="w-4 h-4 text-primary" />
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Créditos de Creación</span>
                        </div>

                        <div className="space-y-3">
                            {/* Andres Jimenez */}
                            <div className="p-3 bg-white/3 border border-white/5 hover:border-primary/20 transition-all rounded-xl">
                                <div className="flex justify-between items-baseline">
                                    <h4 className="text-xs font-black text-white uppercase tracking-tight">Andrés Jiménez</h4>
                                    <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">PROGRAMADOR Y CREADOR</span>
                                </div>
                                <p className="text-[9px] text-txt-muted font-semibold mt-1">Ingeniero Jr — Desarrollo de software, algoritmos y diseño de interfaz.</p>
                            </div>

                            {/* Lenin Peña */}
                            <div className="p-3 bg-white/3 border border-white/5 hover:border-secondary/20 transition-all rounded-xl">
                                <div className="flex justify-between items-baseline">
                                    <h4 className="text-xs font-black text-white uppercase tracking-tight">Lenin Peña</h4>
                                    <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/25">MENTE MAESTRA & ESPECIALISTA ALS</span>
                                </div>
                                <p className="text-[9px] text-txt-muted font-semibold mt-1">Ingeniero Especialista ALS — Modelos matemáticos, arquitectura de procesos y física del reservorio.</p>
                            </div>

                            {/* Frontera Energy Support */}
                            <div className="p-3 bg-white/2 border border-white/5 rounded-xl">
                                <h4 className="text-[9.5px] font-black text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Cpu className="w-3.5 h-3.5 text-primary/70" />
                                    Apoyo — Área ALS Frontera Energy
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-[9px] text-txt-muted font-bold uppercase tracking-wide">
                                    <div className="flex items-center gap-1.5 p-1 bg-white/2 rounded">
                                        <span className="w-1 h-1 rounded-full bg-primary" /> Wirmer Arcos
                                    </div>
                                    <div className="flex items-center gap-1.5 p-1 bg-white/2 rounded">
                                        <span className="w-1 h-1 rounded-full bg-primary" /> Jaime Ochoa
                                    </div>
                                    <div className="flex items-center gap-1.5 p-1 bg-white/2 rounded">
                                        <span className="w-1 h-1 rounded-full bg-primary" /> Luna Muñoz
                                    </div>
                                    <div className="flex items-center gap-1.5 p-1 bg-white/2 rounded">
                                        <span className="w-1 h-1 rounded-full bg-primary" /> Paola Mejía
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT COLUMN: FORM PANEL ── */}
                <div className="w-full md:w-[410px] bg-surface/50 p-8 md:p-9 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                    
                    {/* Access Shield Warning */}
                    <div className="mb-6">
                        <div className="flex items-center justify-center gap-2">
                            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/15">
                                <Shield className="w-3 h-3 text-primary" />
                                <span className="text-[7.5px] font-black uppercase tracking-[0.25em] text-primary">
                                    ACCESO ENCRIPTADO · SECURE GATEWAY
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actual Login Form */}
                    <form onSubmit={handleSubmit} noValidate className="space-y-4 my-auto">
                        <div className="text-center md:text-left mb-6">
                            <h2 className="text-lg font-black text-white uppercase tracking-tight">Iniciar Sesión</h2>
                            <p className="text-[10px] text-txt-muted font-semibold mt-1">Ingresa tus credenciales corporativas autorizadas.</p>
                        </div>

                        {/* Email field */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="login-email"
                                className="text-[9px] font-black uppercase tracking-[0.2em] text-txt-muted flex items-center justify-between"
                            >
                                <span className="flex items-center gap-2">
                                    <Mail className="w-3 h-3 text-primary" />
                                    Correo Electrónico
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
                                    placeholder="correo@empresa.com"
                                    required
                                    autoComplete="email"
                                    className="w-full px-4 py-3 rounded-xl text-sm font-semibold outline-none transition-all duration-300"
                                />
                            </div>

                            {fieldErrors.email && (
                                <p className="text-[10px] text-red-400 font-semibold pl-1">
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
                                    <Lock className="w-3 h-3 text-primary" />
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
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                    className="w-full px-4 py-3 pr-12 rounded-xl text-sm font-semibold outline-none transition-all duration-300"
                                />
                                <button
                                    type="button"
                                    onClick={toggleShowPassword}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all hover:bg-white/5"
                                >
                                    {showPassword
                                        ? <EyeOff className="w-4 h-4 text-txt-muted hover:text-white" />
                                        : <Eye className="w-4 h-4 text-txt-muted hover:text-white" />}
                                </button>
                            </div>

                            {fieldErrors.password && (
                                <p className="text-[10px] text-red-400 font-semibold pl-1">
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
                                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                                <span className="text-[11px] font-bold text-red-400/90">{error}</span>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            id="login-submit"
                            type="submit"
                            disabled={loading || !email || !password}
                            className="w-full py-4 rounded-xl font-black text-xs uppercase tracking-[0.22em] transition-all duration-300 relative overflow-hidden group disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] btn-premium mt-4"
                            style={{
                                background: loading
                                    ? 'rgba(var(--color-primary), .25)'
                                    : 'linear-gradient(135deg, rgb(var(--color-primary)), rgb(var(--color-secondary)))',
                                color: '#ffffff',
                                boxShadow: '0 8px 32px rgba(var(--color-primary), 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                border: '1px solid rgb(var(--color-primary))',
                                cursor: 'pointer',
                            }}
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3">
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Verificando…
                                    </>
                                ) : (
                                    <>
                                        <Shield className="w-4 h-4 transition-transform group-hover:scale-110" />
                                        Entrar al Sistema
                                    </>
                                )}
                            </span>
                        </button>
                    </form>

                    {/* Bottom Status bar */}
                    <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between text-[7px] font-black uppercase tracking-[0.2em] text-txt-muted/50">
                        <span className="flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5 text-primary animate-pulse" />
                            AJM © 2026
                        </span>
                        <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3 text-red-500 animate-[bounce_1.5s_infinite]" />
                            Confeccionado con Pasión
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};