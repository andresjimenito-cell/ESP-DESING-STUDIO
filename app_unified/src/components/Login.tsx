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

    const handleQuickFill = () => {
        setEmail('correo@fronteraenergy.ca');
        setPassword('2026');
        setError('');
    };

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
                    0%, 100% { box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45), 0 0 50px rgba(var(--color-primary), 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.04); }
                    50% { box-shadow: 0 30px 60px rgba(0, 0, 0, 0.55), 0 0 80px rgba(var(--color-primary), 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.06); }
                }
                @keyframes login-ring-cw { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes login-ring-ccw { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
                @keyframes login-logo-illuminate {
                    0%, 100% { filter: brightness(1) drop-shadow(0 0 12px rgba(var(--color-primary), 0.3)); }
                    50%       { filter: brightness(1.2) drop-shadow(0 0 28px rgba(var(--color-primary), 0.6)); }
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
                    0%, 100% { transform: scale(1); opacity: 0.15; }
                    50%       { transform: scale(1.15); opacity: 0.35; }
                }
                @keyframes login-scanline {
                    0%   { transform: translateY(-100%); opacity: 0; }
                    10%  { opacity: 0.04; }
                    90%  { opacity: 0.02; }
                    100% { transform: translateY(100%); opacity: 0; }
                }
                @keyframes login-aurora-glow-1 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(30px, -20px) scale(1.1); }
                }
                @keyframes login-aurora-glow-2 {
                    0%, 100% { transform: translate(0, 0) scale(1.1); }
                    50% { transform: translate(-20px, 30px) scale(0.95); }
                }
                @keyframes login-sheen {
                    0% { transform: translateX(-150%) skewX(-15deg); }
                    100% { transform: translateX(250%) skewX(-15deg); }
                }
                @keyframes login-pulse-green {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 1; transform: scale(1.2); }
                }
                
                .login-card {
                    background: rgba(11, 18, 32, 0.5) !important;
                    backdrop-filter: blur(40px) saturate(220%) !important;
                    border: 1px solid rgba(var(--color-primary), 0.15) !important;
                    transition: border-color 0.4s ease, box-shadow 0.4s ease, transform 0.2s ease-out !important;
                }
                .login-card:hover {
                    border-color: rgba(var(--color-primary), 0.35) !important;
                }
                .input-premium:focus-within {
                    border-color: rgba(var(--color-primary), 0.5) !important;
                    box-shadow: 0 0 20px rgba(var(--color-primary), 0.12), inset 0 0 10px rgba(var(--color-primary), 0.05) !important;
                    background: rgba(var(--color-canvas), 0.7) !important;
                }
                .btn-premium::after {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; width: 60%; height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.24), transparent);
                    transform: translateX(-150%) skewX(-15deg);
                    pointer-events: none;
                }
                .btn-premium:hover::after {
                    animation: login-sheen 1.8s infinite;
                }
            `}</style>

            {/* ── BACKGROUND EFFECTS ── */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Dotted Grid Pattern */}
                <div 
                    className="absolute inset-0 opacity-15"
                    style={{
                        backgroundImage: 'radial-gradient(circle, rgba(var(--color-primary), 0.15) 1.2px, transparent 1.2px)',
                        backgroundSize: '24px 24px',
                        maskImage: 'radial-gradient(circle at center, black 40%, transparent 95%)',
                    }}
                />
                
                {/* Aurora Spheres */}
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

                {/* Particle rise */}
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
                            boxShadow: `0 0 4px rgb(${p.color})`,
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
                    background: 'linear-gradient(to bottom, transparent, rgba(var(--color-primary), 0.02), transparent)',
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
                    transition: 'opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.18s ease-out',
                    animation: mounted ? 'login-glow-pulse 6s ease-in-out infinite' : 'none',
                }}
                className="relative z-10 w-full max-w-[420px] mx-4 max-h-[92vh] overflow-y-auto custom-scrollbar login-card"
            >
                {/* Top gradient accent bar */}
                <div className="h-1.5 w-full shrink-0" style={{
                    background: 'linear-gradient(90deg, rgba(var(--color-primary), 0.9), rgba(var(--color-secondary), 0.7), rgba(var(--color-primary), 0.9))',
                }} />

                <div className="px-9 pt-9 pb-9 flex flex-col justify-between h-full">
                    {/* ── LOGO SECTION ── */}
                    <div className="flex flex-col items-center mb-8 shrink-0">
                        {/* Logo with orbital rings */}
                        <div style={{ position: 'relative', width: 110, height: 110 }}>
                            {/* Outer halo */}
                            <div style={{
                                position: 'absolute', inset: -25,
                                borderRadius: '50%',
                                background: 'radial-gradient(circle, rgba(var(--color-primary), 0.12) 0%, transparent 65%)',
                                animation: 'login-halo-pulse 5s ease-in-out infinite',
                            }} />
                            {/* Orbital ring 1 */}
                            <div style={{
                                position: 'absolute', inset: -8,
                                border: '1px solid rgba(var(--color-primary), 0.15)',
                                borderRadius: '50%',
                                animation: 'login-ring-cw 18s linear infinite',
                            }}>
                                <div style={{
                                    position: 'absolute', top: -2.5, left: '50%',
                                    width: 5, height: 5, borderRadius: '50%',
                                    background: 'rgb(var(--color-primary))',
                                    boxShadow: '0 0 10px rgb(var(--color-primary)), 0 0 20px rgb(var(--color-primary))',
                                    transform: 'translateX(-50%)',
                                }} />
                            </div>
                            {/* Orbital ring 2 */}
                            <div style={{
                                position: 'absolute', inset: -18,
                                border: '0.5px solid rgba(var(--color-secondary), 0.1)',
                                borderRadius: '50%',
                                animation: 'login-ring-ccw 30s linear infinite',
                                transform: 'rotate3d(1, 0.5, 0, 50deg)',
                            }}>
                                <div style={{
                                    position: 'absolute', bottom: -2, right: '30%',
                                    width: 4, height: 4, borderRadius: '50%',
                                    background: 'rgb(var(--color-secondary))',
                                    boxShadow: '0 0 8px rgb(var(--color-secondary))',
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
                                    background: 'linear-gradient(90deg, transparent, rgba(var(--color-secondary), 0.9), transparent)',
                                    boxShadow: '0 0 12px rgba(var(--color-secondary), 0.8)',
                                    animation: 'login-sweep 3.5s ease-in-out infinite',
                                }} />
                            </div>
                        </div>

                        {/* Title */}
                        <div className="mt-5 text-center">
                            <h1 className="text-2xl font-black tracking-tight text-txt-main leading-none uppercase">
                                ESP DESIGN <span style={{ color: 'rgb(var(--color-primary))' }}>STUDIO</span>
                            </h1>
                            <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.35em]" style={{ color: 'rgba(var(--color-primary), 0.65)' }}>
                                FRONTERA ENERGY — PLATAFORMA PRIVADA
                            </p>
                        </div>
                    </div>

                    {/* ── SECURITY BADGE ── */}
                    <div className="flex items-center justify-center gap-2 mb-6 shrink-0">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full"
                            style={{
                                background: 'rgba(var(--color-primary), 0.08)',
                                border: '1px solid rgba(var(--color-primary), 0.16)',
                            }}
                        >
                            <Shield className="w-3.5 h-3.5" style={{ color: 'rgb(var(--color-primary))' }} />
                            <span className="text-[8px] font-black uppercase tracking-[0.25em]" style={{ color: 'rgba(var(--color-primary), 0.8)' }}>
                                ACCESO CIFRADO · HMAC-SHA256
                            </span>
                        </div>
                    </div>

                    {/* ── FORM ── */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-txt-muted flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Mail className="w-3 h-3 text-primary" />
                                    Correo Corporativo
                                </span>
                                <span 
                                    className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                                    style={{
                                        background: email ? 'rgb(var(--color-primary))' : 'rgba(255, 255, 255, 0.15)',
                                        boxShadow: email ? '0 0 8px rgb(var(--color-primary))' : 'none',
                                    }}
                                />
                            </label>
                            <div className="relative">
                                <input
                                    id="login-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                    placeholder="correo@fronteraenergy.ca"
                                    required
                                    autoComplete="email"
                                    className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-txt-main placeholder:text-txt-muted/20 outline-none transition-all duration-300 focus:ring-0 input-premium"
                                    style={{
                                        background: 'rgba(var(--color-canvas), 0.45)',
                                        border: '1px solid rgba(var(--color-primary), 0.15)',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-txt-muted flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Lock className="w-3 h-3 text-primary" />
                                    Contraseña
                                </span>
                                <span 
                                    className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                                    style={{
                                        background: password ? 'rgb(var(--color-primary))' : 'rgba(255, 255, 255, 0.15)',
                                        boxShadow: password ? '0 0 8px rgb(var(--color-primary))' : 'none',
                                    }}
                                />
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
                                    className="w-full px-4 py-3 pr-12 rounded-xl text-sm font-semibold text-txt-main placeholder:text-txt-muted/20 outline-none transition-all duration-300 input-premium"
                                    style={{
                                        background: 'rgba(var(--color-canvas), 0.45)',
                                        border: '1px solid rgba(var(--color-primary), 0.15)',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all hover:bg-white/5"
                                >
                                    {showPassword
                                        ? <EyeOff className="w-4 h-4 text-txt-muted hover:text-white" />
                                        : <Eye className="w-4 h-4 text-txt-muted hover:text-white" />}
                                </button>
                            </div>
                        </div>

                        {/* Error message */}
                        {error && (
                            <div
                                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                                style={{
                                    background: 'rgba(239, 68, 68, 0.08)',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
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
                            className="w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-[0.22em] transition-all duration-500 relative overflow-hidden group disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] btn-premium mt-2"
                            style={{
                                background: loading
                                    ? 'rgba(var(--color-primary), 0.25)'
                                    : 'linear-gradient(135deg, rgb(var(--color-primary)), rgb(var(--color-secondary)))',
                                color: 'white',
                                boxShadow: '0 4px 24px rgba(var(--color-primary), 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                                border: '1px solid rgba(var(--color-primary), 0.2)',
                            }}
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3">
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Verificando...
                                    </>
                                ) : (
                                    <>
                                        <Shield className="w-4 h-4 transition-transform group-hover:scale-110" />
                                        Iniciar Sesión
                                    </>
                                )}
                            </span>
                        </button>
                    </form>

                    {/* ── DEMO CREDENTIALS TERMINAL ── */}
                    <div 
                        onClick={handleQuickFill}
                        className="mt-5 p-3.5 rounded-xl border border-white/5 font-mono text-[10px] cursor-pointer group/term hover:border-primary/30 transition-all duration-300 select-none shrink-0"
                        style={{
                            background: 'rgba(var(--color-canvas), 0.45)',
                        }}
                        title="Haz clic para autocompletar credenciales"
                    >
                        <div className="flex items-center justify-between mb-1.5 border-b border-white/5 pb-1 opacity-70">
                            <span className="text-[8px] font-black uppercase text-txt-muted tracking-wider flex items-center gap-1.5">
                                <span 
                                    className="w-1.5 h-1.5 rounded-full bg-primary" 
                                    style={{ animation: 'login-pulse-green 1.5s infinite' }}
                                />
                                Terminal: Credenciales Demo
                            </span>
                            <span className="text-[8px] font-bold text-primary group-hover/term:underline">
                                Autocompletar click
                            </span>
                        </div>
                        <div className="space-y-0.5 text-txt-muted/80">
                            <div><span style={{ color: 'rgb(var(--color-primary))' }}>CORREO:</span> correo@fronteraenergy.ca</div>
                            <div><span style={{ color: 'rgb(var(--color-primary))' }}>CLAVE:</span> 2026</div>
                        </div>
                    </div>
                </div>

                {/* ── FOOTER STRIP ── */}
                <div className="px-9 py-4 flex items-center justify-between shrink-0"
                    style={{
                        borderTop: '1px solid rgba(var(--color-primary), 0.08)',
                        background: 'rgba(var(--color-canvas), 0.4)',
                    }}
                >
                    <span className="text-[7px] font-black uppercase tracking-[0.25em] flex items-center gap-1.5"
                        style={{ color: 'rgba(var(--color-primary), 0.3)' }}
                    >
                        <span 
                            className="w-1 h-1 rounded-full bg-green-400"
                            style={{ animation: 'login-pulse-green 1s infinite' }}
                        />
                        SSL SECURE
                    </span>
                    <span className="text-[7px] font-black uppercase tracking-[0.25em]"
                        style={{ color: 'rgba(var(--color-primary), 0.3)' }}
                    >
                        ENCRYPTED SESSION
                    </span>
                    <span className="text-[7px] font-black uppercase tracking-[0.25em]"
                        style={{ color: 'rgba(var(--color-primary), 0.3)' }}
                    >
                        AJM © 2026
                    </span>
                </div>
            </div>
        </div>
    );
};
