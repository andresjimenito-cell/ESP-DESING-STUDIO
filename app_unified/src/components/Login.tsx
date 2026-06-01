import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Lock, Mail, Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react';

const SESSION_KEY = 'esp_session_token';
const SESSION_EMAIL_KEY = 'esp_session_email';

export const getSessionToken = (): string | null => sessionStorage.getItem(SESSION_KEY);
export const getSessionEmail = (): string | null => sessionStorage.getItem(SESSION_EMAIL_KEY);

export const clearSession = () => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_EMAIL_KEY);
};

export const isSessionValid = (): boolean => {
    const token = getSessionToken();
    if (!token) return false;
    try {
        const parts = token.split('.');
        if (parts.length !== 2) return false;
        const payload = JSON.parse(atob(parts[0]));
        if (!payload.exp || payload.exp < Date.now()) {
            clearSession();
            return false;
        }
        if (!payload.email || !payload.email.toLowerCase().endsWith('@fronteraenergy.ca')) {
            clearSession();
            return false;
        }
        return true;
    } catch {
        clearSession();
        return false;
    }
};

interface LoginProps {
    onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [mounted, setMounted] = useState(false);


    useEffect(() => {
        requestAnimationFrame(() => setMounted(true));
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({
                x: (e.clientX / window.innerWidth - 0.5) * 15,
                y: (e.clientY / window.innerHeight - 0.5) * 15,
            });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const fieldParticles = useMemo(() => {
        return Array.from({ length: 25 }).map((_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: 1 + Math.random() * 3,
            speed: 25 + Math.random() * 50,
            drift: (Math.random() - 0.5) * 30,
            delay: Math.random() * -25,
            opacity: 0.15 + Math.random() * 0.45,
            color: i % 3 === 0 ? 'var(--color-primary)' : i % 3 === 1 ? 'var(--color-secondary)' : 'var(--color-accent)',
        }));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error || 'No tienes acceso a archivos privados de la organización.');
                setLoading(false);
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
            setError('No tienes acceso a archivos privados de la organización.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden font-sans"
            style={{
                backgroundColor: 'rgb(var(--color-canvas))',
                backgroundImage: 'linear-gradient(rgb(var(--color-canvas) / 0.8), rgb(var(--color-canvas) / 0.85)), url(/main_bg.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            <style>{`
                @keyframes login-particle-rise {
                    0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
                    5%   { opacity: var(--op); }
                    95%  { opacity: calc(var(--op) * 0.5); }
                    100% { transform: translateY(-80vh) translateX(var(--drift)) scale(0.4); opacity: 0; }
                }
                @keyframes login-fade-in {
                    from { opacity: 0; transform: translateY(30px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes login-glow-pulse {
                    0%, 100% { box-shadow: 0 0 40px rgba(var(--color-primary), 0.1), 0 0 80px rgba(var(--color-primary), 0.05); }
                    50% { box-shadow: 0 0 60px rgba(var(--color-primary), 0.2), 0 0 120px rgba(var(--color-primary), 0.08); }
                }
                @keyframes login-ring-cw { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes login-ring-ccw { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
                @keyframes login-logo-illuminate {
                    0%, 100% { filter: brightness(1) drop-shadow(0 0 12px rgba(var(--color-primary), 0.25)); }
                    50%       { filter: brightness(1.15) drop-shadow(0 0 28px rgba(var(--color-primary), 0.45)); }
                }
                @keyframes login-sweep {
                    0%   { top: -4px; opacity: 0; }
                    5%   { opacity: 1; }
                    92%  { opacity: 0.5; }
                    100% { top: 100%; opacity: 0; }
                }
                @keyframes login-shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                    20%, 40%, 60%, 80% { transform: translateX(4px); }
                }
                @keyframes login-halo-pulse {
                    0%, 100% { transform: scale(1); opacity: 0.2; }
                    50%       { transform: scale(1.12); opacity: 0.4; }
                }
                @keyframes login-scanline {
                    0%   { transform: translateY(-100%); opacity: 0; }
                    10%  { opacity: 0.05; }
                    90%  { opacity: 0.02; }
                    100% { transform: translateY(100%); opacity: 0; }
                }
            `}</style>

            {/* ── BACKGROUND EFFECTS ── */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-0"
                    style={{
                        background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(var(--color-primary), 0.06) 0%, transparent 65%), radial-gradient(ellipse 60% 50% at 20% 70%, rgba(var(--color-secondary), 0.04) 0%, transparent 60%)'
                    }}
                />
                <div className="absolute inset-0 opacity-15"
                    style={{
                        backgroundImage: 'radial-gradient(circle, rgba(var(--color-primary), 0.12) 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                        maskImage: 'radial-gradient(circle at center, black 30%, transparent 90%)',
                    }}
                />
                {fieldParticles.map(p => (
                    <div
                        key={p.id}
                        className="absolute rounded-full"
                        style={{
                            left: `${p.x}%`,
                            bottom: '-8px',
                            width: p.size,
                            height: p.size,
                            background: `rgb(${p.color})`,
                            boxShadow: `0 0 3px rgb(${p.color})`,
                            '--op': p.opacity,
                            '--drift': `${p.drift}px`,
                            animation: `login-particle-rise ${p.speed}s linear ${p.delay}s infinite`,
                            opacity: 0,
                        } as any}
                    />
                ))}
                {/* Scanline */}
                <div style={{
                    position: 'absolute', left: 0, right: 0, height: '30%',
                    background: 'linear-gradient(to bottom, transparent, rgba(var(--color-primary), 0.03), transparent)',
                    animation: 'login-scanline 9s linear infinite',
                    pointerEvents: 'none',
                }} />
            </div>

            {/* ── MAIN LOGIN CARD ── */}
            <div
                style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted
                        ? `perspective(1200px) rotateY(${mousePos.x * 0.2}deg) rotateX(${-mousePos.y * 0.2}deg) translateY(0) scale(1)`
                        : 'translateY(30px) scale(0.97)',
                    transition: 'opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.15s ease-out',
                    animation: mounted ? 'login-glow-pulse 5s ease-in-out infinite' : 'none',
                }}
                className="relative z-10 w-full max-w-[420px] mx-4"
            >
                {/* Glass card */}
                <div
                    className="relative rounded-3xl overflow-hidden"
                    style={{
                        background: 'rgba(var(--color-surface), 0.6)',
                        backdropFilter: 'blur(40px) saturate(180%)',
                        border: '1px solid rgba(var(--color-primary), 0.12)',
                    }}
                >
                    {/* Top gradient accent bar */}
                    <div className="h-1 w-full" style={{
                        background: 'linear-gradient(90deg, rgba(var(--color-primary), 0.8), rgba(var(--color-secondary), 0.6), rgba(var(--color-primary), 0.8))',
                    }} />

                    <div className="px-10 pt-10 pb-10">
                        {/* ── LOGO SECTION ── */}
                        <div className="flex flex-col items-center mb-10">
                            {/* Logo with orbital rings */}
                            <div style={{ position: 'relative', width: 120, height: 120 }}>
                                {/* Outer halo */}
                                <div style={{
                                    position: 'absolute', inset: -30,
                                    borderRadius: '50%',
                                    background: 'radial-gradient(circle, rgba(var(--color-primary), 0.1) 0%, transparent 65%)',
                                    animation: 'login-halo-pulse 5s ease-in-out infinite',
                                }} />
                                {/* Orbital ring 1 */}
                                <div style={{
                                    position: 'absolute', inset: -12,
                                    border: '1px solid rgba(var(--color-primary), 0.1)',
                                    borderRadius: '50%',
                                    animation: 'login-ring-cw 18s linear infinite',
                                }}>
                                    <div style={{
                                        position: 'absolute', top: -2, left: '50%',
                                        width: 4, height: 4, borderRadius: '50%',
                                        background: 'rgb(var(--color-primary))',
                                        boxShadow: '0 0 8px rgb(var(--color-primary))',
                                        transform: 'translateX(-50%)',
                                    }} />
                                </div>
                                {/* Orbital ring 2 */}
                                <div style={{
                                    position: 'absolute', inset: -22,
                                    border: '0.5px solid rgba(var(--color-secondary), 0.07)',
                                    borderRadius: '50%',
                                    animation: 'login-ring-ccw 30s linear infinite',
                                    transform: 'rotate3d(1, 0.5, 0, 55deg)',
                                }}>
                                    <div style={{
                                        position: 'absolute', bottom: -1.5, right: '30%',
                                        width: 3, height: 3, borderRadius: '50%',
                                        background: 'rgb(var(--color-secondary))',
                                        boxShadow: '0 0 5px rgb(var(--color-secondary))',
                                    }} />
                                </div>
                                {/* Logo image */}
                                <div style={{
                                    position: 'relative', width: '100%', height: '100%',
                                    animation: 'login-logo-illuminate 4s ease-in-out infinite',
                                }}>
                                    <img
                                        src="/LOGO.png"
                                        alt="ESP Design Studio"
                                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                                    />
                                    {/* Scan line */}
                                    <div style={{
                                        position: 'absolute', top: 0, left: -6, right: -6, height: '2px',
                                        background: 'linear-gradient(90deg, transparent, rgba(var(--color-secondary), 0.8), transparent)',
                                        boxShadow: '0 0 10px rgba(var(--color-secondary), 0.7)',
                                        animation: 'login-sweep 3.5s ease-in-out infinite',
                                    }} />
                                </div>
                            </div>

                            {/* Title */}
                            <div className="mt-6 text-center">
                                <h1 className="text-2xl font-black tracking-tighter text-txt-main leading-none">
                                    ESP DESIGN <span style={{ color: 'rgb(var(--color-primary))' }}>STUDIO</span>
                                </h1>
                                <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.35em]" style={{ color: 'rgba(var(--color-primary), 0.5)' }}>
                                    FRONTERA ENERGY — PLATAFORMA PRIVADA
                                </p>
                            </div>
                        </div>

                        {/* ── SECURITY BADGE ── */}
                        <div className="flex items-center justify-center gap-2 mb-8">
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full"
                                style={{
                                    background: 'rgba(var(--color-primary), 0.06)',
                                    border: '1px solid rgba(var(--color-primary), 0.1)',
                                }}
                            >
                                <Shield className="w-3.5 h-3.5" style={{ color: 'rgb(var(--color-primary))' }} />
                                <span className="text-[8px] font-black uppercase tracking-[0.25em]" style={{ color: 'rgba(var(--color-primary), 0.6)' }}>
                                    ACCESO CIFRADO · HMAC-SHA256
                                </span>
                            </div>
                        </div>

                        {/* ── FORM ── */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Email */}
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-txt-muted flex items-center gap-2">
                                    <Mail className="w-3 h-3" style={{ color: 'rgb(var(--color-primary))' }} />
                                    Correo Corporativo
                                </label>
                                <div className="relative">
                                    <input
                                        id="login-email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                        placeholder="Introduce tu correo corporativo"
                                        required
                                        autoComplete="email"
                                        className="w-full px-4 py-3.5 rounded-xl text-sm font-semibold text-txt-main placeholder:text-txt-muted/30 outline-none transition-all duration-300 focus:ring-2"
                                        style={{
                                            background: 'rgba(var(--color-canvas), 0.6)',
                                            border: '1px solid rgba(var(--color-primary), 0.1)',
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = 'rgba(var(--color-primary), 0.4)';
                                            e.target.style.boxShadow = '0 0 0 3px rgba(var(--color-primary), 0.1), 0 0 20px rgba(var(--color-primary), 0.05)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = 'rgba(var(--color-primary), 0.1)';
                                            e.target.style.boxShadow = 'none';
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-txt-muted flex items-center gap-2">
                                    <Lock className="w-3 h-3" style={{ color: 'rgb(var(--color-primary))' }} />
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <input
                                        id="login-password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                        placeholder="••••••••••"
                                        required
                                        autoComplete="current-password"
                                        className="w-full px-4 py-3.5 pr-12 rounded-xl text-sm font-semibold text-txt-main placeholder:text-txt-muted/30 outline-none transition-all duration-300"
                                        style={{
                                            background: 'rgba(var(--color-canvas), 0.6)',
                                            border: '1px solid rgba(var(--color-primary), 0.1)',
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = 'rgba(var(--color-primary), 0.4)';
                                            e.target.style.boxShadow = '0 0 0 3px rgba(var(--color-primary), 0.1), 0 0 20px rgba(var(--color-primary), 0.05)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = 'rgba(var(--color-primary), 0.1)';
                                            e.target.style.boxShadow = 'none';
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all hover:bg-white/5"
                                    >
                                        {showPassword
                                            ? <EyeOff className="w-4 h-4 text-txt-muted" />
                                            : <Eye className="w-4 h-4 text-txt-muted" />}
                                    </button>
                                </div>
                            </div>

                            {/* Error message */}
                            {error && (
                                <div
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.08)',
                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                        animation: 'login-shake 0.5s ease-in-out',
                                    }}
                                >
                                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                                    <span className="text-[11px] font-bold text-red-400/90">{error}</span>
                                </div>
                            )}

                            {/* Submit button */}
                            <button
                                id="login-submit"
                                type="submit"
                                disabled={loading || !email || !password}
                                className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all duration-500 relative overflow-hidden group disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                                style={{
                                    background: loading
                                        ? 'rgba(var(--color-primary), 0.3)'
                                        : 'linear-gradient(135deg, rgba(var(--color-primary), 0.9), rgba(var(--color-secondary), 0.7))',
                                    color: 'white',
                                    boxShadow: '0 4px 30px rgba(var(--color-primary), 0.25)',
                                }}
                            >
                                {/* Hover glow */}
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(var(--color-primary), 1), rgba(var(--color-secondary), 0.9))',
                                        boxShadow: '0 8px 40px rgba(var(--color-primary), 0.4)',
                                    }}
                                />
                                <span className="relative z-10 flex items-center justify-center gap-3">
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Verificando...
                                        </>
                                    ) : (
                                        <>
                                            <Shield className="w-4 h-4" />
                                            Iniciar Sesión
                                        </>
                                    )}
                                </span>
                            </button>
                        </form>
                    </div>

                    {/* ── FOOTER STRIP ── */}
                    <div className="px-10 py-4 flex items-center justify-center gap-6"
                        style={{
                            borderTop: '1px solid rgba(var(--color-primary), 0.06)',
                            background: 'rgba(var(--color-canvas), 0.3)',
                        }}
                    >
                        <span className="text-[7px] font-black uppercase tracking-[0.3em]"
                            style={{ color: 'rgba(var(--color-primary), 0.2)' }}
                        >
                            SECURE_CHANNEL
                        </span>
                        <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(var(--color-primary), 0.2)' }} />
                        <span className="text-[7px] font-black uppercase tracking-[0.3em]"
                            style={{ color: 'rgba(var(--color-primary), 0.2)' }}
                        >
                            ENCRYPTED_SESSION
                        </span>
                        <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(var(--color-primary), 0.2)' }} />
                        <span className="text-[7px] font-black uppercase tracking-[0.3em]"
                            style={{ color: 'rgba(var(--color-primary), 0.2)' }}
                        >
                            AJM © 2026
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
