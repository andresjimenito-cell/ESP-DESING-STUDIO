import React, {
    useState,
    useEffect,
    useMemo,
    useCallback,
    useRef,
} from 'react';
import { useTheme } from '../theme';
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

// ─── Inline styles ────────────────────────────────────────────────────────────

const ANIMATIONS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

  @keyframes login-particle-rise {
    0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
    5%   { opacity: var(--op); }
    95%  { opacity: calc(var(--op) * 0.5); }
    100% { transform: translateY(-90vh) translateX(var(--drift)) scale(0.3); opacity: 0; }
  }
  @keyframes login-float-logo {
    0%, 100% { transform: translateY(0px) scale(1); }
    50%       { transform: translateY(-6px) scale(1.02); }
  }
  @keyframes login-halo {
    0%, 100% { opacity: 0.35; transform: scale(1); }
    50%       { opacity: 0.6; transform: scale(1.08); }
  }
  @keyframes login-shake {
    0%, 100%              { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
    20%, 40%, 60%, 80%    { transform: translateX(4px); }
  }
  @keyframes login-scanline {
    0%   { transform: translateY(-100%); opacity: 0; }
    10%  { opacity: .02; }
    90%  { opacity: .01; }
    100% { transform: translateY(100%); opacity: 0; }
  }
  @keyframes login-fade-up {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes login-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes login-ring-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(var(--color-primary), 0.18); }
    50%       { box-shadow: 0 0 0 10px rgba(var(--color-primary), 0); }
  }
  @keyframes login-dot-blink {
    0%, 100% { opacity: 1; } 50% { opacity: 0.3; }
  }
  @keyframes login-sweep {
    0% { transform: translateX(-100%) skewX(-20deg); }
    100% { transform: translateX(300%) skewX(-20deg); }
  }

  .login-root * { font-family: 'Sora', sans-serif; }
  .login-mono  { font-family: 'DM Mono', monospace; }

  /* ── LEFT PANEL ── */
  .login-left-panel {
    background: rgb(var(--color-canvas));
    position: relative;
  }

  /* Subtle grid texture on left panel */
  .login-left-panel::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(var(--color-primary), 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(var(--color-primary), 0.04) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
    pointer-events: none;
  }

  /* ── LOGO ── */
  .login-logo-wrapper {
    animation: login-float-logo 5s ease-in-out infinite;
  }
  .login-logo-halo {
    animation: login-halo 4s ease-in-out infinite;
  }

  /* ── FEATURE PILLS ── */
  .login-feature-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid rgba(var(--color-primary), 0.15);
    background: rgba(var(--color-primary), 0.05);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgb(var(--color-primary));
    transition: all 0.2s ease;
  }
  .login-feature-pill:hover {
    background: rgba(var(--color-primary), 0.12);
    border-color: rgba(var(--color-primary), 0.35);
    transform: translateY(-1px);
  }
  .login-feature-pill .pill-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
    animation: login-dot-blink 2s ease-in-out infinite;
  }

  /* ── CREDIT CARDS ── */
  .login-credit-card {
    border-radius: 14px;
    padding: 14px 16px;
    border: 1px solid rgba(var(--color-primary), 0.1);
    background: rgba(var(--color-surface-light), 0.4);
    transition: all 0.25s ease;
    backdrop-filter: blur(8px);
  }
  .login-credit-card:hover {
    border-color: rgba(var(--color-primary), 0.28);
    background: rgba(var(--color-primary), 0.04);
    transform: translateX(3px);
  }
  .login-credit-badge {
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 999px;
  }

  /* ── RIGHT PANEL / FORM ── */
  .login-right-panel {
    background: rgb(var(--color-surface));
    position: relative;
    overflow: hidden;
  }

  /* Diagonal accent stripe */
  .login-right-panel::before {
    content: '';
    position: absolute;
    top: -60px; right: -60px;
    width: 260px; height: 260px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(var(--color-primary), 0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .login-right-panel::after {
    content: '';
    position: absolute;
    bottom: -80px; left: -80px;
    width: 300px; height: 300px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(var(--color-secondary), 0.06) 0%, transparent 70%);
    pointer-events: none;
  }

  /* ── FORM INPUTS ── */
  .login-input-wrap {
    position: relative;
    border-radius: 12px;
    border: 1.5px solid rgba(var(--color-primary), 0.15);
    background: rgb(var(--color-canvas));
    transition: all 0.22s cubic-bezier(0.4,0,0.2,1);
    overflow: hidden;
  }
  .login-input-wrap:focus-within {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.12);
    background: rgb(var(--color-surface-light));
  }
  .login-input-wrap input {
    width: 100%;
    padding: 13px 16px 13px 42px;
    background: transparent;
    border: none;
    outline: none;
    font-size: 13px;
    font-weight: 500;
    font-family: 'Sora', sans-serif;
    color: rgb(var(--color-text-main));
  }
  .login-input-wrap input::placeholder {
    color: rgba(var(--color-text-muted), 0.5);
    font-weight: 400;
  }
  .login-input-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(var(--color-primary), 0.5);
    transition: color 0.2s;
    pointer-events: none;
  }
  .login-input-wrap:focus-within .login-input-icon {
    color: rgb(var(--color-primary));
  }

  /* ── SUBMIT BUTTON ── */
  .login-btn-submit {
    width: 100%;
    padding: 14px 24px;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    font-family: 'Sora', sans-serif;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #fff;
    background: linear-gradient(135deg,
      rgb(var(--color-primary)) 0%,
      rgb(var(--color-secondary)) 100%
    );
    box-shadow:
      0 4px 20px rgba(var(--color-primary), 0.35),
      inset 0 1px 0 rgba(255,255,255,0.15);
    transition: all 0.22s ease;
    animation: login-ring-pulse 3s ease-in-out infinite;
  }
  .login-btn-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow:
      0 8px 28px rgba(var(--color-primary), 0.45),
      inset 0 1px 0 rgba(255,255,255,0.2);
  }
  .login-btn-submit:active:not(:disabled) {
    transform: translateY(0);
  }
  .login-btn-submit:disabled {
    opacity: 0.38;
    cursor: not-allowed;
    animation: none;
  }
  /* Shimmer sweep on hover */
  .login-btn-submit::after {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 40%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent);
    transform: translateX(-150%) skewX(-20deg);
    pointer-events: none;
  }
  .login-btn-submit:hover:not(:disabled)::after {
    animation: login-sweep 1.6s ease-in-out infinite;
  }

  /* ── DIVIDER ── */
  .login-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    color: rgba(var(--color-text-muted), 0.4);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .login-divider::before,
  .login-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(var(--color-primary), 0.1);
  }

  /* ── SCROLLBAR ── */
  .login-scroll::-webkit-scrollbar { width: 4px; }
  .login-scroll::-webkit-scrollbar-track { background: transparent; }
  .login-scroll::-webkit-scrollbar-thumb {
    background: rgba(var(--color-primary), 0.15);
    border-radius: 99px;
  }

  /* ── FADE UP ANIMATION ── */
  .login-fade-up {
    animation: login-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both;
  }
  .login-fade-up-1 { animation-delay: 0.05s; }
  .login-fade-up-2 { animation-delay: 0.12s; }
  .login-fade-up-3 { animation-delay: 0.19s; }
  .login-fade-up-4 { animation-delay: 0.26s; }
  .login-fade-up-5 { animation-delay: 0.33s; }
`;

// ─── Main component ───────────────────────────────────────────────────────────

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const { theme } = useTheme();
    const isDarkTheme = theme === 'fusion' || theme === 'cyber';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    const lastMouseTime = useRef(0);

    useEffect(() => {
        const id = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(id);
    }, []);

    const fieldParticles = useMemo<Particle[]>(() =>
        Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: 1.2 + Math.random() * 3,
            speed: 20 + Math.random() * 45,
            drift: (Math.random() - 0.5) * 40,
            delay: Math.random() * -20,
            opacity: 0.15 + Math.random() * 0.3,
            color: PARTICLE_COLORS[i % 3],
        })),
        []);

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

    // Theme-aware colors
    const textMain = isDarkTheme ? 'rgba(255,255,255,0.92)' : 'rgb(var(--color-text-main))';
    const textMuted = isDarkTheme ? 'rgba(255,255,255,0.45)' : 'rgba(var(--color-text-muted),0.7)';
    const textSub = isDarkTheme ? 'rgba(255,255,255,0.6)' : 'rgba(var(--color-text-muted),0.85)';
    const dividerColor = isDarkTheme ? 'rgba(255,255,255,0.06)' : 'rgba(var(--color-primary),0.08)';

    return (
        <div
            className="login-root fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
            style={{
                backgroundColor: 'rgb(var(--color-canvas))',
                backgroundImage: 'linear-gradient(rgb(var(--color-canvas) / 0.75), rgb(var(--color-canvas) / 0.75)), url(/main_bg.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            <style>{ANIMATIONS}</style>

            {/* Ambient particle layer */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <ParticleField particles={fieldParticles} />
                <div style={{
                    position: 'absolute', left: 0, right: 0,
                    height: '30%',
                    background: 'linear-gradient(to bottom, transparent, rgba(var(--color-primary),0.01), transparent)',
                    animation: 'login-scanline 12s linear infinite',
                }} />
            </div>

            {/* ── MAIN CARD ── */}
            <div
                role="main"
                aria-label="Inicio de sesión ESP Design Studio"
                style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
                    transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
                    width: '100%',
                    maxWidth: '900px',
                    maxHeight: '94vh',
                    display: 'flex',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    boxShadow: isDarkTheme
                        ? '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(var(--color-primary),0.12)'
                        : '0 20px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(var(--color-primary),0.1)',
                }}
                className="relative z-10 flex-col md:flex-row mx-4"
            >
                {/* ══════════════════════════════════════
                    LEFT PANEL — Brand & Credits
                ══════════════════════════════════════ */}
                <div
                    className="login-left-panel flex-1 flex flex-col items-center justify-between text-center"
                    style={{ padding: '60px 40px', minWidth: 0 }}
                >
                    {/* Spacer to balance vertical centering */}
                    <div />

                    {/* Centered Logo & App Name */}
                    <div className="login-fade-up login-fade-up-1 flex flex-col items-center">
                        {/* Logo wrapper */}
                        <div style={{ position: 'relative', marginBottom: '32px' }}>
                            {/* Outer halo ring */}
                            <div
                                className="login-logo-halo"
                                style={{
                                    position: 'absolute',
                                    inset: '-26px',
                                    borderRadius: '50%',
                                    border: '1.5px solid rgba(var(--color-primary), 0.2)',
                                    pointerEvents: 'none',
                                }}
                            />
                            {/* Glow */}
                            <div style={{
                                position: 'absolute',
                                inset: '-12px',
                                borderRadius: '50%',
                                background: 'radial-gradient(circle, rgba(var(--color-primary),0.15) 0%, transparent 70%)',
                                pointerEvents: 'none',
                            }} />
                            {/* Logo */}
                            <div
                                className="login-logo-wrapper"
                                style={{
                                    width: '180px', height: '180px',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    border: '2px solid rgba(var(--color-primary),0.25)',
                                    background: isDarkTheme
                                        ? 'rgba(255,255,255,0.04)'
                                        : 'rgba(var(--color-primary),0.04)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '20px',
                                }}
                            >
                                <img
                                    src="/LOGO.png"
                                    alt="ESP Design Studio Logo"
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                            </div>
                        </div>

                        {/* App Title */}
                        <h1 style={{
                            fontSize: '28px',
                            fontWeight: 800,
                            letterSpacing: '-0.02em',
                            lineHeight: 1.1,
                            color: textMain,
                            margin: 0,
                        }}>
                            ESP Design{' '}
                            <span style={{ color: 'rgb(var(--color-primary))' }}>Studio</span>
                        </h1>
                        <p
                            className="login-mono"
                            style={{
                                fontSize: '10px',
                                fontWeight: 500,
                                letterSpacing: '0.28em',
                                textTransform: 'uppercase',
                                color: 'rgba(var(--color-primary), 0.6)',
                                marginTop: '8px',
                            }}
                        >
                            Engineering Suite · v2026
                        </p>
                    </div>

                    {/* Small Creators Footer */}
                    <div className="login-fade-up login-fade-up-2" style={{ width: '100%', maxWidth: '380px' }}>
                        <div style={{ height: '1px', background: dividerColor, marginBottom: '20px' }} />
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            fontSize: '9px',
                            color: textMuted,
                            lineHeight: 1.6,
                            fontWeight: 500,
                        }}>
                            <p style={{ margin: 0 }}>
                                <strong>Creador y Programador:</strong> Andrés Jiménez (Ing. Jr)
                            </p>
                            <p style={{ margin: 0 }}>
                                <strong>Mente Maestra:</strong> Lenin Peña (Especialista ALS)
                            </p>
                            <p style={{ margin: 0, opacity: 0.8, fontSize: '8.5px' }}>
                                <strong>Apoyo:</strong> Wirmer Arcos, Jaime Ochoa, Luna Muñoz, Paola Mejía (Frontera Energy)
                            </p>
                        </div>

                        <div style={{
                            marginTop: '16px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            fontSize: '8px',
                            color: textMuted,
                            opacity: 0.8,
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Zap style={{ width: 10, height: 10, color: 'rgb(var(--color-primary))' }} />
                                AJM © 2026
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Heart style={{ width: 9, height: 9, color: '#f87171' }} />
                                Confeccionado con Pasión
                            </span>
                        </div>
                    </div>
                </div>

                {/* ══════════════════════════════════════
                    RIGHT PANEL — Login Form
                ══════════════════════════════════════ */}
                <div
                    className="login-right-panel login-scroll"
                    style={{
                        width: '100%',
                        maxWidth: '420px',
                        flexShrink: 0,
                        borderLeft: isDarkTheme
                            ? '1px solid rgba(255,255,255,0.05)'
                            : '1px solid rgba(var(--color-primary),0.08)',
                        padding: '48px 40px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        overflowY: 'auto',
                    }}
                >
                    {/* Secure gateway badge */}
                    <div className="login-fade-up login-fade-up-1" style={{ marginBottom: '36px' }}>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '7px',
                            padding: '6px 14px',
                            borderRadius: '999px',
                            background: 'rgba(var(--color-primary),0.08)',
                            border: '1px solid rgba(var(--color-primary),0.15)',
                        }}>
                            <Shield style={{ width: 11, height: 11, color: 'rgb(var(--color-primary))' }} />
                            <span
                                className="login-mono"
                                style={{ fontSize: '8px', fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgb(var(--color-primary))' }}
                            >
                                Acceso encriptado · Secure Gateway
                            </span>
                        </div>
                    </div>

                    {/* Heading */}
                    <div className="login-fade-up login-fade-up-2" style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', color: textMain, margin: '0 0 8px' }}>
                            Bienvenido de vuelta
                        </h2>
                        <p style={{ fontSize: '12px', color: textSub, margin: 0, lineHeight: 1.6 }}>
                            Ingresa tus credenciales corporativas para acceder.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                        {/* Email */}
                        <div className="login-fade-up login-fade-up-3" style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                            <label
                                htmlFor="login-email"
                                style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: textMuted, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                            >
                                <span>Correo Electrónico</span>
                                {email && (
                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgb(var(--color-primary))', boxShadow: '0 0 6px rgba(var(--color-primary),0.8)' }} />
                                )}
                            </label>
                            <div className={`login-input-wrap${fieldErrors.email ? ' error' : ''}`} style={fieldErrors.email ? { borderColor: 'rgba(239,68,68,0.5)' } : {}}>
                                <Mail className="login-input-icon" style={{ width: 15, height: 15 }} />
                                <input
                                    id="login-email"
                                    type="email"
                                    value={email}
                                    onChange={e => { setEmail(e.target.value); clearErrors(); }}
                                    placeholder="@"
                                    required
                                    autoComplete="email"
                                />
                            </div>
                            {fieldErrors.email && (
                                <p style={{ fontSize: '10px', color: '#f87171', fontWeight: 600, margin: 0 }}>{fieldErrors.email}</p>
                            )}
                        </div>

                        {/* Password */}
                        <div className="login-fade-up login-fade-up-4" style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                            <label
                                htmlFor="login-password"
                                style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: textMuted, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                            >
                                <span>Contraseña</span>
                                {password && (
                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgb(var(--color-primary))', boxShadow: '0 0 6px rgba(var(--color-primary),0.8)' }} />
                                )}
                            </label>
                            <div className="login-input-wrap" style={fieldErrors.password ? { borderColor: 'rgba(239,68,68,0.5)' } : {}}>
                                <Lock className="login-input-icon" style={{ width: 15, height: 15 }} />
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); clearErrors(); }}
                                    placeholder="••••••••••"
                                    required
                                    autoComplete="current-password"
                                    style={{ paddingRight: '48px' }}
                                />
                                <button
                                    type="button"
                                    onClick={toggleShowPassword}
                                    style={{
                                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        padding: '4px', borderRadius: '6px',
                                        color: 'rgba(var(--color-text-muted),0.5)',
                                        transition: 'color 0.2s',
                                    }}
                                >
                                    {showPassword
                                        ? <EyeOff style={{ width: 15, height: 15 }} />
                                        : <Eye style={{ width: 15, height: 15 }} />}
                                </button>
                            </div>
                            {fieldErrors.password && (
                                <p style={{ fontSize: '10px', color: '#f87171', fontWeight: 600, margin: 0 }}>{fieldErrors.password}</p>
                            )}
                        </div>

                        {/* Error banner */}
                        {error && (
                            <div
                                role="alert"
                                style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                                    padding: '12px 14px',
                                    borderRadius: '10px',
                                    background: 'rgba(239,68,68,0.07)',
                                    border: '1px solid rgba(239,68,68,0.2)',
                                    animation: 'login-shake 0.5s ease-in-out',
                                }}
                            >
                                <AlertTriangle style={{ width: 14, height: 14, color: '#f87171', flexShrink: 0, marginTop: '1px' }} />
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(248,113,113,0.9)', lineHeight: 1.5 }}>{error}</span>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            id="login-submit"
                            type="submit"
                            disabled={loading || !email || !password}
                            className="login-fade-up login-fade-up-5 login-btn-submit"
                            style={{ marginTop: '4px' }}
                        >
                            <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                {loading ? (
                                    <>
                                        <Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} />
                                        Verificando credenciales…
                                    </>
                                ) : (
                                    <>
                                        <Shield style={{ width: 15, height: 15 }} />
                                        Entrar al Sistema
                                    </>
                                )}
                            </span>
                        </button>
                    </form>

                    {/* Bottom note */}
                    <div style={{
                        marginTop: '28px',
                        padding: '14px',
                        borderRadius: '10px',
                        background: 'rgba(var(--color-primary),0.04)',
                        border: '1px solid rgba(var(--color-primary),0.08)',
                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                    }}>
                        <Shield style={{ width: 12, height: 12, color: 'rgba(var(--color-primary),0.5)', flexShrink: 0, marginTop: '1px' }} />
                        <p style={{ fontSize: '10px', color: textMuted, margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
                            Acceso restringido a usuarios autorizados. Todas las sesiones son auditadas y encriptadas.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};