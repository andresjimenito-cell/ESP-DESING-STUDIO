
import React, { useRef, useEffect, useState } from 'react';
import { 
  Globe, Command, FileText, User, Briefcase, ChevronRight, UploadCloud, 
  Activity, Layers, Cpu, Zap, Power, Palette, Sun, Moon
} from 'lucide-react';
import { SystemParams } from '../types';
import { useTheme } from '../theme';

interface LandingPageProps {
    onStart: () => void;
    params: SystemParams;
    setParams: React.Dispatch<React.SetStateAction<SystemParams>>;
    language: string;
    toggleLanguage: () => void;
    onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
    onStart, 
    params, 
    setParams, 
    language, 
    toggleLanguage,
    onImportFile
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const { theme, cycleTheme, toggleLightMode } = useTheme();

    // Parallax effect on mouse move
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({
                x: (e.clientX / window.innerWidth - 0.5) * 15,
                y: (e.clientY / window.innerHeight - 0.5) * 15
            });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
      <div className="h-screen w-full bg-canvas relative flex items-center justify-center overflow-hidden font-sans text-txt-main selection:bg-primary/30 transition-colors duration-700">
        
        {/* --- DYNAMIC BACKGROUND LAYER --- */}
        <div className="absolute inset-0 z-0 overflow-hidden">
            {/* Main Image with Scale Animation - Increased opacity/visibility */}
            <div 
                className="absolute inset-0 bg-cover bg-center transition-transform duration-[50ms] ease-out scale-105 opacity-60 mix-blend-overlay"
                style={{ 
                    // High quality Offshore Oil Rig image
                    backgroundImage: `url('https://images.unsplash.com/photo-1599940824399-b87987ced72a?q=80&w=2927&auto=format&fit=crop')`,
                    transform: `scale(1.05) translate(${mousePos.x * -1}px, ${mousePos.y * -1}px)`
                }}
            />
            
            {/* Cinematic Overlays - Tuned for better image visibility while keeping text readable */}
            <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/80 to-transparent opacity-95 transition-colors duration-700"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/60 to-transparent opacity-90 transition-colors duration-700"></div>
            <div className="absolute inset-0 bg-primary/5 mix-blend-overlay transition-colors duration-700"></div>
            
            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] opacity-10"></div>
        </div>

        {/* --- TOP NAVIGATION --- */}
        <div className="absolute top-0 left-0 w-full p-8 z-50 flex justify-between items-start animate-fadeIn">
            <div className="flex flex-col">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_25px_rgba(var(--color-primary),0.6)] transition-colors duration-500">
                        <Activity className="text-canvas w-8 h-8 transition-colors duration-500" />
                    </div>
                    <span className="text-3xl font-black tracking-[0.1em] text-txt-main uppercase">SimCore<span className="text-primary transition-colors duration-500">.AI</span></span>
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs font-bold text-txt-muted uppercase tracking-widest pl-1">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
                    System Online v3.0 | Theme: {theme}
                </div>
            </div>

            <div className="flex gap-4">
                <button 
                    onClick={toggleLightMode} 
                    className="group flex items-center gap-4 bg-surface/40 backdrop-blur-md border border-white/10 px-4 py-4 rounded-full hover:bg-white/10 transition-all hover:border-primary/50"
                    title="Toggle Light/Dark Mode"
                >
                    {theme === 'light' ? <Moon className="w-6 h-6 text-txt-muted group-hover:text-primary transition-colors" /> : <Sun className="w-6 h-6 text-txt-muted group-hover:text-primary transition-colors" />}
                </button>

                <button 
                    onClick={cycleTheme} 
                    className="group flex items-center gap-4 bg-surface/40 backdrop-blur-md border border-white/10 px-4 py-4 rounded-full hover:bg-white/10 transition-all hover:border-primary/50"
                    title="Cycle Color Themes"
                >
                    <Palette className="w-6 h-6 text-txt-muted group-hover:text-primary transition-colors" />
                </button>

                <button 
                    onClick={toggleLanguage} 
                    className="group flex items-center gap-4 bg-surface/40 backdrop-blur-md border border-white/10 px-8 py-4 rounded-full hover:bg-white/10 transition-all hover:border-primary/50"
                >
                    <Globe className="w-6 h-6 text-txt-muted group-hover:text-primary transition-colors" />
                    <span className="text-sm font-black uppercase text-txt-main group-hover:text-primary transition-colors">{language === 'en' ? 'EN' : 'ES'}</span>
                </button>
            </div>
        </div>

        {/* --- MAIN CONTENT SPLIT --- */}
        <div className="relative z-30 w-full max-w-[1900px] px-8 md:px-16 grid grid-cols-1 xl:grid-cols-2 gap-4 items-center h-full pt-10">
            
            {/* LEFT: HUGE TYPOGRAPHY & CONTEXT */}
            <div className="flex flex-col justify-center space-y-8 animate-fadeIn delay-100 xl:pr-10">
                
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-primary uppercase tracking-[0.3em] flex items-center gap-6 transition-colors duration-500">
                        <span className="w-16 h-1 bg-primary shadow-[0_0_15px_rgba(var(--color-primary),0.8)] transition-colors duration-500"></span>
                        {language === 'es' ? 'Ingeniería de Precisión' : 'Precision Engineering'}
                    </h2>
                    {/* Typography: Scaled down slightly from previous iteration to fit better next to card */}
                    <h1 className="text-7xl md:text-8xl lg:text-9xl font-black text-txt-main leading-[0.85] tracking-tighter drop-shadow-2xl transition-colors duration-500">
                        ESP<br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-txt-muted via-txt-main to-txt-muted">DESIGN</span><br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary transition-colors duration-700">STUDIO</span>
                    </h1>
                </div>

                <p className="text-xl md:text-2xl text-txt-muted max-w-2xl font-medium leading-relaxed border-l-8 border-surface-light pl-8 py-2 transition-colors duration-500">
                    {language === 'es' 
                        ? "Plataforma avanzada para el dimensionamiento, simulación y análisis de sistemas de bombeo electrosumergible con integración de IA."
                        : "Advanced platform for sizing, simulation, and analysis of electrical submersible pumping systems with AI integration."}
                </p>

                {/* Tech Specs / Stats Row */}
                <div className="flex flex-wrap gap-10 pt-6">
                    <div className="flex items-center gap-5 group cursor-default">
                        <div className="p-4 bg-surface-light/50 rounded-3xl border border-surface-light group-hover:border-primary/50 transition-colors"><Zap className="w-8 h-8 text-primary transition-colors duration-500" /></div>
                        <div>
                            <div className="text-3xl font-black text-txt-main">VFD</div>
                            <div className="text-xs font-bold text-txt-muted uppercase tracking-widest mt-1">Simulation</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-5 group cursor-default">
                        <div className="p-4 bg-surface-light/50 rounded-3xl border border-surface-light group-hover:border-secondary/50 transition-colors"><Layers className="w-8 h-8 text-secondary transition-colors duration-500" /></div>
                        <div>
                            <div className="text-3xl font-black text-txt-main">PVT</div>
                            <div className="text-xs font-bold text-txt-muted uppercase tracking-widest mt-1">Physics Core</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-5 group cursor-default">
                        <div className="p-4 bg-surface-light/50 rounded-3xl border border-surface-light group-hover:border-emerald-500/50 transition-colors"><Cpu className="w-8 h-8 text-emerald-400" /></div>
                        <div>
                            <div className="text-3xl font-black text-txt-main">AI</div>
                            <div className="text-xs font-bold text-txt-muted uppercase tracking-widest mt-1">Optimization</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT: INTERACTIVE HUD / LOGIN FORM */}
            <div className="flex justify-center xl:justify-start xl:pl-8 animate-fadeIn delay-300">
                <div className="w-full max-w-[550px] relative group">
                    
                    {/* Decorative Backdrop Glow */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-[45px] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                    
                    <div className="relative w-full bg-surface/80 backdrop-blur-2xl border border-surface-light/60 rounded-[40px] p-10 shadow-2xl overflow-hidden transition-colors duration-500">
                        
                        {/* Header of Card */}
                        <div className="flex items-center justify-between mb-8 pb-6 border-b border-surface-light/50">
                            <h3 className="text-2xl font-black text-txt-main uppercase tracking-tight flex items-center gap-4">
                                <Command className="w-7 h-7 text-primary transition-colors duration-500" /> 
                                {language === 'es' ? 'Nueva Sesión' : 'New Session'}
                            </h3>
                            <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-widest animate-pulse transition-colors duration-500">
                                Ready
                            </div>
                        </div>

                        {/* Inputs */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest ml-1 flex items-center gap-2">
                                    {language === 'es' ? 'Identificador de Proyecto' : 'Project ID'}
                                </label>
                                <div className="relative group/input">
                                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                        <FileText className="w-5 h-5 text-txt-muted group-focus-within/input:text-primary transition-colors duration-300" />
                                    </div>
                                    <input 
                                        type="text" 
                                        value={params.metadata.projectName} 
                                        onChange={e => setParams({...params, metadata: {...params.metadata, projectName: e.target.value}})} 
                                        className="w-full bg-canvas/60 border border-surface-light text-txt-main font-bold text-xl rounded-2xl py-5 pl-14 pr-6 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-surface-light/50" 
                                        placeholder="ESP-JOB-202X" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest ml-1">
                                        {language === 'es' ? 'Ingeniero' : 'Engineer'}
                                    </label>
                                    <div className="relative group/input">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <User className="w-4 h-4 text-txt-muted group-focus-within/input:text-secondary transition-colors" />
                                        </div>
                                        <input 
                                            type="text" 
                                            value={params.metadata.engineer} 
                                            onChange={e => setParams({...params, metadata: {...params.metadata, engineer: e.target.value}})} 
                                            className="w-full bg-canvas/60 border border-surface-light text-base text-txt-main font-bold rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all placeholder:text-surface-light/50" 
                                            placeholder="Name" 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest ml-1">
                                        {language === 'es' ? 'Cliente' : 'Client'}
                                    </label>
                                    <div className="relative group/input">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Briefcase className="w-4 h-4 text-txt-muted group-focus-within/input:text-secondary transition-colors" />
                                        </div>
                                        <input 
                                            type="text" 
                                            value={params.metadata.company} 
                                            onChange={e => setParams({...params, metadata: {...params.metadata, company: e.target.value}})} 
                                            className="w-full bg-canvas/60 border border-surface-light text-base text-txt-main font-bold rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all placeholder:text-surface-light/50" 
                                            placeholder="Company" 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-10 space-y-4">
                            <button 
                                onClick={onStart} 
                                className="group relative w-full overflow-hidden rounded-2xl bg-primary p-5 transition-all hover:bg-primary/90 active:scale-[0.98] shadow-2xl shadow-primary/30 hover:shadow-primary/40"
                            >
                                <div className="relative z-10 flex items-center justify-center gap-4">
                                    <Power className="w-6 h-6 fill-current text-white" />
                                    <span className="font-black uppercase tracking-[0.2em] text-lg text-white">
                                        {language === 'es' ? 'INICIAR DISEÑO' : 'INITIALIZE DESIGN'}
                                    </span>
                                    <ChevronRight className="w-6 h-6 text-white transition-transform group-hover:translate-x-2" />
                                </div>
                                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full"></div>
                            </button>

                            <div className="flex items-center justify-center pt-2">
                                <input type="file" ref={fileInputRef} accept=".json" className="hidden" onChange={onImportFile} />
                                <button 
                                    onClick={() => fileInputRef.current?.click()} 
                                    className="flex items-center gap-2 text-xs font-bold text-txt-muted hover:text-txt-main uppercase tracking-widest transition-colors py-2 px-6 rounded-xl hover:bg-surface-light/50 border border-transparent hover:border-surface-light"
                                >
                                    <UploadCloud className="w-4 h-4" /> 
                                    {language === 'es' ? 'Cargar Archivo .JSON' : 'Load .JSON File'}
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

        </div>
        
        {/* --- FOOTER DECORATION --- */}
        <div className="absolute bottom-0 left-0 w-full p-8 flex justify-between items-end pointer-events-none z-40 text-xs font-bold text-txt-muted uppercase tracking-widest">
            <div className="flex gap-10">
                <span className="flex items-center gap-3"><div className="w-2 h-2 bg-surface-light rounded-full"></div>28.4231° N, 91.0319° W</span>
                <span className="hidden md:inline text-txt-muted/80">Offshore Module 4B</span>
            </div>
            <div>
                ESP Studio © 2025
            </div>
        </div>

        {/* Industrial Overlay Lines */}
        <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent z-10"></div>
        <div className="absolute left-12 bottom-0 w-px h-96 bg-gradient-to-t from-primary/30 to-transparent z-10"></div>

      </div>
    );
};
