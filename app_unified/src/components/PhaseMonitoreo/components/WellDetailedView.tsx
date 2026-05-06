import React, { useState } from 'react';
import { WellFleetItem, SystemParams, EspPump, ProductionTest } from '@/types';
import { 
    AlertTriangle, Globe, ChevronLeft, ChevronRight, Search, Database, 
    Settings, Activity, TrendingUp, Palette, Minimize2, Maximize2, Layers 
} from 'lucide-react';
import { fuzzyWellName } from '../utils/dataExtractors';
import { computeWellCapacity, getOptimizationPath } from '../utils/healthEngine';
import { calculateBaseHead, calculateSystemResults } from '@/utils';
import { INITIAL_PARAMS, FALLBACK_PUMP } from '../constants';
import { VisualESPStack } from '../../VisualESPStack';
import { Phase6 } from '../../Phase6';
import { MatchHistorico } from '../../MatchHistorico';
import { SecureWrapper } from '../../SecureWrapper';
import { PredictiveWidget } from './PredictiveWidget';

interface WellDetailedViewProps {
    selectedWell: WellFleetItem;
    wellMatchParams: SystemParams;
    pump: EspPump;
    wellViewMode: 'monitoring' | 'history';
    customDesigns: Record<string, SystemParams>;
    wellsHistoricalData: Record<string, ProductionTest[]>;
    onBack: () => void;
    setSelectedWellId: (id: string | null) => void;
    setWellViewMode: (mode: 'monitoring' | 'history') => void;
    isWellDropdownOpen: boolean;
    setIsWellDropdownOpen: (open: boolean) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    dataFilter: string;
    setDataFilter: (filter: any) => void;
    healthFilter: string;
    setHealthFilter: (filter: any) => void;
    sortedFleet: WellFleetItem[];
    wellHealthMap: Record<string, number>;
    language: string;
    toggleLanguage: () => void;
    cycleTheme: () => void;
    zoomLevel: number;
    setZoomLevel: (zoom: number) => void;
    importDbRef: React.RefObject<HTMLInputElement>;
    importWellHistoryRef: React.RefObject<HTMLInputElement>;
    onNavigateToDesign?: (params: SystemParams, pump: EspPump) => void;
}

export const WellDetailedView: React.FC<WellDetailedViewProps> = ({
    selectedWell, wellMatchParams, pump, wellViewMode, customDesigns, wellsHistoricalData,
    onBack, setSelectedWellId, setWellViewMode, isWellDropdownOpen, setIsWellDropdownOpen,
    searchTerm, setSearchTerm, dataFilter, setDataFilter, healthFilter, setHealthFilter,
    sortedFleet, wellHealthMap, language, toggleLanguage, cycleTheme, zoomLevel, setZoomLevel,
    importDbRef, importWellHistoryRef, onNavigateToDesign
}) => {
    const [isBhaMinimized, setIsBhaMinimized] = useState(false);
    const hasMatch = selectedWell.productionTest.hasMatchData || selectedWell.currentRate > 0;

    const q = selectedWell.productionTest.rate || 0.1;
    const f = selectedWell.productionTest.freq || 60;
    const pMD = selectedWell.depthMD || 5000;

    const physicalHealth = {
        pump: selectedWell.health.pump,
        motor: selectedWell.health.motor,
        seal: selectedWell.health.seal,
        cable: selectedWell.health.cable,
        sensor: selectedWell.health.sensor,
        vsd: (selectedWell.predictive.vsdStatus === 'alert') ? 'alert' : (selectedWell.predictive.vsdStatus === 'caution' ? 'caution' : 'normal') as any
    };

    const baseFreq = pump?.nameplateFrequency || 60;
    const ratio = f / baseFreq;
    const head = calculateBaseHead(q / ratio, pump) * Math.pow(ratio, 2);
    const liveBhaResults = calculateSystemResults(q, head, wellMatchParams, pump, f) || { pip: selectedWell.productionTest.pip, motorLoad: Math.abs(selectedWell.consumptionReal) };

    return (
        <div className="space-y-8 animate-fadeIn p-4 pb-20 relative">
            {!hasMatch && (
                <div className="mb-4 bg-danger/10 border border-danger/30 p-10 rounded-[3rem] flex items-center justify-between shadow-glow-danger/5 animate-fadeIn">
                    <div className="flex items-center gap-8">
                        <div className="p-6 bg-danger/20 rounded-3xl border border-danger/20 text-danger"><AlertTriangle className="w-12 h-12" /></div>
                        <div>
                            <h3 className="text-3xl font-black text-danger uppercase mb-2 tracking-tighter italic">Faltan Datos de Cotejo (Match)</h3>
                            <p className="text-sm font-bold text-danger/70 uppercase tracking-widest leading-relaxed max-w-2xl">El diseño cargado no contiene datos de historial. Se requiere cargar una prueba de producción o configurar el cotejo manual.</p>
                        </div>
                    </div>
                </div>
            )}

            {wellMatchParams.survey.length === 0 && (
                <div className="mb-4 bg-warning/10 border border-warning/30 p-8 rounded-[2.5rem] flex items-center justify-between shadow-glow-warning/5 animate-fadeIn">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-warning/20 rounded-2xl border border-warning/20 text-warning"><Globe className="w-8 h-8" /></div>
                        <div>
                            <h3 className="text-xl font-black text-warning uppercase mb-1 tracking-tighter">Trayectoria (Survey) No Encontrada</h3>
                            <p className="text-[10px] font-bold text-warning/70 uppercase tracking-widest leading-relaxed max-w-xl">No se pudo vincular automáticamente una trayectoria direccional para el pozo "{selectedWell.name}".</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center bg-surface/40 backdrop-blur-xl py-3 px-6 rounded-2xl border border-white/5 shadow-2xl relative group z-20">
                <div className="flex items-center gap-6 relative z-10 w-full">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2.5 bg-white/10 hover:bg-primary/20 rounded-xl border border-white/10 text-txt-muted hover:text-primary transition-all group shadow-lg" title="Regresar al Inicio">
                            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1" />
                        </button>

                        <div className="relative">
                            <button onClick={() => setIsWellDropdownOpen(!isWellDropdownOpen)} className="flex items-center gap-3 px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl border border-white/10 transition-all shadow-lg cursor-pointer group/dd">
                                <h2 className="text-xl font-black text-txt-main tracking-tighter uppercase leading-none group-hover/dd:text-primary transition-colors">{selectedWell.name}</h2>
                                <ChevronRight className={`w-4 h-4 text-txt-muted transition-transform duration-300 ${isWellDropdownOpen ? 'rotate-90' : ''}`} />
                            </button>
                            {isWellDropdownOpen && (
                                <div className="absolute top-full left-0 mt-3 w-[450px] max-h-[500px] overflow-y-auto bg-surface/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.5)] z-[100] animate-fadeIn custom-scrollbar">
                                    <div className="p-3 border-b border-white/5 space-y-2">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted/50" />
                                            <input type="text" placeholder="Buscar pozo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-canvas/60 border border-surface-light rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-txt-main focus:outline-none focus:border-primary/50 uppercase tracking-wider placeholder:text-txt-muted/30" />
                                        </div>
                                        <div className="flex items-center gap-1 bg-canvas/40 p-1 rounded-xl border border-white/5">
                                            <button onClick={(e) => { e.stopPropagation(); setDataFilter('all'); }} className={`h-7 px-2.5 rounded-lg flex items-center justify-center transition-all text-[8px] font-black uppercase tracking-widest flex-1 ${dataFilter === 'all' ? 'bg-primary text-white shadow-sm' : 'text-txt-muted hover:bg-white/5'}`}>Datos: Todos</button>
                                            <button onClick={(e) => { e.stopPropagation(); setDataFilter('complete'); }} className={`h-7 px-2.5 rounded-lg flex items-center justify-center transition-all text-[8px] font-black uppercase tracking-widest flex-1 ${dataFilter === 'complete' ? 'bg-success/20 text-success' : 'text-txt-muted hover:bg-white/5'}`}>Completos</button>
                                            <button onClick={(e) => { e.stopPropagation(); setDataFilter('missing'); }} className={`h-7 px-2.5 rounded-lg flex items-center justify-center transition-all text-[8px] font-black uppercase tracking-widest flex-1 ${dataFilter === 'missing' ? 'bg-warning/20 text-warning' : 'text-txt-muted hover:bg-white/5'}`}>Faltan</button>
                                        </div>
                                        <div className="flex items-center gap-1 bg-canvas/40 p-1 rounded-xl border border-white/5">
                                            <button onClick={(e) => { e.stopPropagation(); setHealthFilter('all'); }} className={`h-7 px-2.5 rounded-lg flex items-center justify-center transition-all text-[8px] font-black uppercase tracking-widest flex-1 ${healthFilter === 'all' ? 'bg-primary text-white shadow-sm' : 'text-txt-muted hover:bg-white/5'}`}>Salud: Todos</button>
                                            <button onClick={(e) => { e.stopPropagation(); setHealthFilter('healthy'); }} className={`h-7 px-2.5 rounded-lg flex items-center justify-center transition-all text-[8px] font-black uppercase tracking-widest flex-1 ${healthFilter === 'healthy' ? 'bg-success/20 text-success' : 'text-txt-muted hover:bg-white/5'}`}>Healthy</button>
                                            <button onClick={(e) => { e.stopPropagation(); setHealthFilter('caution'); }} className={`h-7 px-2.5 rounded-lg flex items-center justify-center transition-all text-[8px] font-black uppercase tracking-widest flex-1 ${healthFilter === 'caution' ? 'bg-warning/20 text-warning' : 'text-txt-muted hover:bg-white/5'}`}>Caution</button>
                                            <button onClick={(e) => { e.stopPropagation(); setHealthFilter('critical'); }} className={`h-7 px-2.5 rounded-lg flex items-center justify-center transition-all text-[8px] font-black uppercase tracking-widest flex-1 ${healthFilter === 'critical' ? 'bg-danger/20 text-danger' : 'text-txt-muted hover:bg-white/5'}`}>Critical</button>
                                        </div>
                                    </div>
                                    <div className="p-2">
                                        {sortedFleet.map(well => {
                                            const health = wellHealthMap[well.id] || 0;
                                            const isActive = well.id === selectedWell.id;
                                            return (
                                                <button key={well.id} onClick={() => { setSelectedWellId(well.id); setWellViewMode('monitoring'); setIsWellDropdownOpen(false); setSearchTerm(''); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-left mb-1 ${isActive ? 'bg-primary/20 border border-primary/30' : 'hover:bg-white/5 border border-transparent'}`}>
                                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${health >= 85 ? 'bg-success shadow-glow-success' : health >= 60 ? 'bg-warning' : 'bg-danger shadow-glow-danger'}`}></div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-sm font-black uppercase tracking-tight truncate ${isActive ? 'text-primary' : 'text-txt-main'}`}>{well.name}</span>
                                                        </div>
                                                        <span className="text-[9px] font-bold text-txt-muted uppercase tracking-widest">{Math.round(well.currentRate)} BPD • {well.productionTest.freq || 0} Hz</span>
                                                    </div>
                                                    <span className={`text-xs font-black ${health >= 85 ? 'text-success' : health >= 60 ? 'text-warning' : 'text-danger'}`}>{health}%</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-1 justify-center">
                        <button onClick={() => importDbRef.current?.click()} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20 hover:shadow-glow-secondary/20"><Database className="w-4 h-4" />Subir Prueba</button>
                        {onNavigateToDesign && (
                            <SecureWrapper isLocked={true} tooltip="Módulo de Diseño Restringido">
                                <button onClick={() => onNavigateToDesign(wellMatchParams, pump)} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white hover:shadow-glow-primary/40"><Settings className="w-4 h-4" />Diseño</button>
                            </SecureWrapper>
                        )}
                        <SecureWrapper isLocked={true} tooltip="Módulo de Ajuste Histórico Restringido">
                            <button onClick={() => setWellViewMode(wellViewMode === 'history' ? 'monitoring' : 'history')} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${wellViewMode === 'history' ? 'bg-primary text-white border-primary shadow-glow-primary/40' : 'bg-success/10 text-success border-success/20 hover:bg-success/20 hover:shadow-glow-success/20'}`}>
                                {wellViewMode === 'history' ? <Activity className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                                {wellViewMode === 'history' ? 'Monitoreo' : 'Histórico (Match)'}
                            </button>
                        </SecureWrapper>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10 shadow-inner ml-auto">
                        <button onClick={toggleLanguage} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 rounded-lg transition-all text-[9px] font-black font-mono text-txt-main tracking-widest uppercase"><Globe className="w-3.5 h-3.5 text-primary" /> {language}</button>
                        <button onClick={cycleTheme} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/5 text-txt-muted hover:text-primary hover:border-primary/20 group/palette"><Palette className="w-4 h-4 text-secondary group-hover/palette:text-primary" /></button>
                        <button onClick={() => setZoomLevel(zoomLevel === 1 ? 0.8 : 1)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/5 text-txt-muted hover:text-primary hover:border-primary/20 group/palette">{zoomLevel === 1 ? <Minimize2 className="w-4 h-4 text-primary" /> : <Maximize2 className="w-4 h-4 text-primary" />}</button>
                    </div>
                </div>
            </div>

            {wellViewMode === 'history' ? (
                <MatchHistorico wellName={selectedWell.name} pump={pump} designParams={wellMatchParams} productionHistory={wellsHistoricalData[fuzzyWellName(selectedWell.name)]} onImport={() => importWellHistoryRef.current?.click()} onClose={() => setWellViewMode('monitoring')} />
            ) : (
                <div className="flex flex-col gap-6 animate-fadeIn relative z-10 mt-12">
                    <PredictiveWidget selectedWell={selectedWell} wellMatchParams={wellMatchParams} pump={pump} computeWellCapacity={computeWellCapacity} getOptimizationPath={getOptimizationPath} />
                    <div className="flex gap-6 items-stretch w-full min-h-[900px] relative mt-16 lg:mt-0">
                        <div className={`glass-surface rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl flex flex-col relative group transition-all duration-500 ${isBhaMinimized ? 'w-20' : 'w-[400px]'}`}>
                            {!isBhaMinimized && (
                                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5 backdrop-blur-md">
                                    <button onClick={() => setIsBhaMinimized(true)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 text-primary"><ChevronLeft className="w-5 h-5" /></button>
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-secondary/10 rounded-xl text-secondary border border-secondary/20"><Layers className="w-4 h-4" /></div>
                                        <h3 className="text-xs font-black text-txt-main uppercase tracking-widest">Esquema BHA</h3>
                                    </div>
                                    <Activity className="w-4 h-4 text-primary animate-pulse" />
                                </div>
                            )}
                            <div className={`flex-1 relative bg-canvas/40 overflow-hidden flex items-center justify-center p-4 transition-all duration-500 ${isBhaMinimized ? 'opacity-30 grayscale' : 'opacity-100'}`}>
                                <div className="absolute inset-0 opacity-10 pointer-events-none blueprint-grid"></div>
                                <div className={`h-full origin-top flex items-center justify-center w-full transition-all duration-500 ${isBhaMinimized ? 'scale-[0.4] translate-y-10' : 'scale-100'}`}>
                                    <VisualESPStack pump={pump} motor={wellMatchParams.selectedMotor || undefined} params={wellMatchParams} results={liveBhaResults} frequency={f} health={physicalHealth as any} selectedVSD={wellMatchParams.selectedVSD} />
                                </div>
                            </div>
                            {isBhaMinimized && (
                                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-canvas/80 backdrop-blur-sm cursor-pointer group-hover:bg-canvas/60 transition-all" onClick={() => setIsBhaMinimized(false)}>
                                    <div className="flex flex-col items-center gap-6 bg-primary/10 text-primary border border-primary/20 p-4 rounded-full shadow-glow-primary group-hover:bg-primary group-hover:text-white transition-all duration-500">
                                        <Layers className="w-5 h-5" />
                                        <div className="[writing-mode:vertical-lr] text-[12px] font-black uppercase tracking-[0.4em] transform rotate-180 whitespace-nowrap">VER BHA ESP</div>
                                        <Maximize2 className="w-5 h-5 mt-2 animate-bounce" />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 glass-surface rounded-[3rem] border border-white/5 shadow-3xl overflow-y-auto custom-scrollbar relative z-30" style={{ minHeight: '900px' }}>
                            {hasMatch ? (
                                <Phase6 key={selectedWell.id} params={wellMatchParams} setParams={() => { }} pump={pump} designFreq={selectedWell.productionTest.freq || 60} />
                            ) : (
                                <div className="h-[600px] flex flex-col items-center justify-center space-y-6 text-center px-10">
                                    <div className="p-8 bg-warning/10 rounded-full border border-warning/30 animate-pulse shadow-glow-warning/30"><AlertTriangle className="w-16 h-16 text-warning" /></div>
                                    <h3 className="text-3xl font-black text-warning uppercase tracking-tighter">Análisis de Match Incompleto</h3>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
