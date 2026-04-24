
import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, Key, AlertCircle, ChevronRight, Fingerprint } from 'lucide-react';

interface SecurityLockProps {
    children: React.ReactNode;
}

export const SecurityLock: React.FC<SecurityLockProps> = ({ children }) => {
    const [isLocked, setIsLocked] = useState(true);
    const [accessKey, setAccessKey] = useState('');
    const [error, setError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // LLAVE MAESTRA (En un entorno real, esto vendría de una variable de entorno o servidor)
    const MASTER_KEY = 'ESP2026'; 

    useEffect(() => {
        const saved = localStorage.getItem('esp_studio_access');
        if (saved === 'granted') {
            setIsLocked(false);
        }
    }, []);

    const handleUnlock = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsLoading(true);
        setError(false);

        // Simulamos una verificación "segura"
        setTimeout(() => {
            if (accessKey === MASTER_KEY) {
                localStorage.setItem('esp_studio_access', 'granted');
                setIsLocked(false);
            } else {
                setError(true);
                setIsLoading(false);
            }
        }, 800);
    };

    if (!isLocked) return <>{children}</>;

    return (
        <div className="fixed inset-0 z-[9999] bg-[#0a0c10] flex items-center justify-center p-6 font-sans">
            {/* Fondo de seguridad con gradientes y rejilla */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px]"></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.02) 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
            </div>

            <div className="w-full max-w-md relative animate-fadeIn">
                <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[32px] p-10 shadow-2xl overflow-hidden relative">
                    {/* Barra de estado superior */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
                    
                    <div className="flex flex-col items-center text-center mb-10">
                        <div className="w-20 h-20 bg-gradient-to-br from-primary via-primary to-secondary rounded-2xl flex items-center justify-center shadow-glow-primary mb-6 ring-4 ring-white/5 relative group">
                            <Lock className={`w-8 h-8 text-white transition-all duration-500 ${isLoading ? 'scale-75 opacity-0' : 'scale-100 opacity-100'}`} />
                            {isLoading && <ShieldCheck className="w-8 h-8 text-white absolute animate-pulse" />}
                        </div>
                        
                        <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">
                            Terminal de Acceso
                        </h1>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] opacity-60">
                            ESP DESIGN STUDIO - PRO SUITE
                        </p>
                    </div>

                    <form onSubmit={handleUnlock} className="space-y-6">
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">
                                <Key className="w-4 h-4" />
                            </div>
                            <input
                                type="password"
                                value={accessKey}
                                onChange={(e) => setAccessKey(e.target.value)}
                                placeholder="INGRESE LLAVE DE PROYECTO"
                                className={`w-full bg-white/5 border ${error ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 group-focus-within:border-primary/50'} rounded-2xl py-4 pl-12 pr-4 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none transition-all tracking-[0.5em]`}
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-3 text-red-400 bg-red-400/10 p-4 rounded-xl animate-shake border border-red-400/20">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span className="text-[10px] font-black uppercase tracking-wider">Acceso Denegado: Llave no válida</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || !accessKey}
                            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all shadow-glow-primary flex items-center justify-center gap-3 group relative overflow-hidden"
                        >
                            <span className="text-[10px] uppercase tracking-[0.3em] relative z-10">
                                {isLoading ? 'AUTENTICANDO...' : 'DESBLOQUEAR ENTORNO'}
                            </span>
                            {!isLoading && <ChevronRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />}
                            
                            {/* Efecto de brillo al pasar */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                        </button>
                    </form>

                    <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-between opacity-40">
                        <div className="flex items-center gap-2">
                            <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Encrypt 256-bit</span>
                        </div>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Frontera Energy ALS</span>
                    </div>
                </div>

                <p className="text-center mt-8 text-slate-600 text-[10px] font-bold uppercase tracking-widest leading-relaxed px-10">
                    Este entorno contiene datos técnicos propietarios. <br />
                    El acceso no autorizado está estrictamente restringido.
                </p>
            </div>
        </div>
    );
};
