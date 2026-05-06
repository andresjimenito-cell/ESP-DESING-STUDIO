import React, { useRef } from 'react';
import { Database, Download, Activity, RefreshCw } from 'lucide-react';
import { SystemParams, EspPump, EspMotor } from '@/types';

// Hooks
import { useFleetState } from './PhaseMonitoreo/hooks/useFleetState';
import { useFileProcessing } from './PhaseMonitoreo/hooks/useFileProcessing';
import { useAnalysisEngine } from './PhaseMonitoreo/hooks/useAnalysisEngine';

// Components
import { WellDetailedView } from './PhaseMonitoreo/components/WellDetailedView';
import { FleetDashboard } from './PhaseMonitoreo/components/FleetDashboard';
import { FleetAlertsPanel } from './PhaseMonitoreo/components/FleetAlertsPanel';
import { FloatingAiPanel } from './PhaseMonitoreo/components/FloatingAiPanel';

// Utils
import { useLanguage } from '@/i18n';
import { useTheme } from '@/theme';

interface Props {
    params: SystemParams;
    pump: EspPump | null;
    pumpCatalog?: EspPump[];
    motorCatalog?: EspMotor[];
    onBack: () => void;
    onNavigateToDesign?: (wellParams: SystemParams, pump?: EspPump | null) => void;
}

const PhaseMonitoreo: React.FC<Props> = ({
    params,
    pump: providedPump,
    pumpCatalog = [],
    motorCatalog = [],
    onBack,
    onNavigateToDesign
}) => {
    // 1. Core State
    const {
        fleet, setFleet,
        customDesigns, setCustomDesigns,
        wellsHistoricalData, setWellsHistoricalData,
        selectedWellId, setSelectedWellId,
        searchTerm, setSearchTerm,
        dataFilter, setDataFilter,
        healthFilter, setHealthFilter,
        zoomLevel, setZoomLevel,
        wellViewMode, setWellViewMode
    } = useFleetState();

    // 2. Analysis Engine
    const analysis = useAnalysisEngine({
        fleet, customDesigns, selectedWellId, params, providedPump,
        searchTerm, dataFilter, healthFilter
    });

    // 3. File Processing
    const {
        importProgress,
        processExcelDesignsBuffer,
        processScadaBuffer
    } = useFileProcessing({
        pumpCatalog, motorCatalog, setFleet, setCustomDesigns, setWellsHistoricalData
    });

    // 4. State
    const [isWellDropdownOpen, setIsWellDropdownOpen] = React.useState(false);

    // 5. Refs
    const importDesignRef = useRef<HTMLInputElement>(null);
    const importDbRef = useRef<HTMLInputElement>(null);
    const importWellHistoryRef = useRef<HTMLInputElement>(null);

    // 6. Context
    const { language, setLanguage, t } = useLanguage();
    const toggleLanguage = () => setLanguage(language === 'es' ? 'en' : 'es');
    const { cycleTheme } = useTheme();

    // 7. Handlers
    const handleImportDesign = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const json = JSON.parse(event.target?.result as string);
                    const wellName = (json.metadata?.wellName || `WELL-${Math.random().toString(36).substr(2, 5)}`).toUpperCase();
                    setCustomDesigns(prev => ({ ...prev, [wellName]: json }));
                    setFleet(prev => {
                        if (prev.find(w => w.name.toUpperCase() === wellName)) return prev;
                        return [...prev, {
                            id: `well-${Date.now()}-${wellName}`,
                            name: wellName, status: 'normal',
                            currentRate: json.pressures?.totalRate || 0,
                            targetRate: json.pressures?.totalRate || 0,
                            health: { pump: 'normal', motor: 'normal', seal: 'normal', cable: 'normal', sensor: 'active' },
                            predictive: { ttf: 365, vsdStatus: 'optimal', vsdAnalysis: 'Stable', transformerStatus: 'optimal', transformerAnalysis: 'Normal', ventBoxStatus: 'optimal', ventBoxAnalysis: 'Clean' },
                            lastUpdate: new Date().toISOString(),
                            depthMD: json.wellbore?.tubingBottom || 5000,
                            consumptionReal: 85, consumptionTheo: 82,
                            productionTest: {
                                date: new Date().toISOString().split('T')[0],
                                rate: json.pressures?.totalRate || 0,
                                freq: 60, thp: json.pressures?.pht || 0, waterCut: json.fluids?.waterCut || 0,
                                pip: 0, pdp: 0, gor: 0, hp: 0, hasMatchData: false
                            }
                        }];
                    });
                } catch (err) { console.error("Error parsing design JSON", err); }
            };
            reader.readAsText(file);
        });
        e.target.value = '';
    };

    const handleImportDb = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = event.target?.result as ArrayBuffer;
            await processScadaBuffer(data);
            e.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div style={{ zoom: zoomLevel }} className="min-h-full pb-20 px-6 py-0 transition-all duration-700">
            <div className="flex gap-6 mt-6 pb-20">
                <div className="flex-1 min-w-0 transition-all duration-500">
                    {fleet.length === 0 ? (
                        <FleetDashboard 
                            importDesignRef={importDesignRef} 
                            importDbRef={importDbRef} 
                        />
                    ) : (
                        analysis.selectedWell ? (
                            <WellDetailedView 
                                selectedWell={analysis.selectedWell}
                                wellMatchParams={analysis.wellMatchParams}
                                pump={analysis.pump}
                                wellViewMode={wellViewMode}
                                customDesigns={customDesigns}
                                wellsHistoricalData={wellsHistoricalData}
                                onBack={onBack}
                                setSelectedWellId={setSelectedWellId}
                                setWellViewMode={setWellViewMode}
                                isWellDropdownOpen={isWellDropdownOpen}
                                setIsWellDropdownOpen={setIsWellDropdownOpen} 
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                dataFilter={dataFilter}
                                setDataFilter={setDataFilter}
                                healthFilter={healthFilter}
                                setHealthFilter={setHealthFilter}
                                sortedFleet={analysis.sortedFleet}
                                wellHealthMap={analysis.wellHealthMap}
                                language={language}
                                toggleLanguage={toggleLanguage}
                                cycleTheme={cycleTheme}
                                zoomLevel={zoomLevel}
                                setZoomLevel={setZoomLevel}
                                importDbRef={importDbRef}
                                importWellHistoryRef={importWellHistoryRef}
                                onNavigateToDesign={onNavigateToDesign}
                            />
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                                <div className="lg:col-span-2">
                                    <FleetDashboard importDesignRef={importDesignRef} importDbRef={importDbRef} />
                                </div>
                                <div className="lg:col-span-1">
                                    <FleetAlertsPanel fleet={fleet} setSelectedWellId={setSelectedWellId} customDesigns={customDesigns} providedPump={providedPump} />
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>


            {/* Floating Components */}
            <FloatingAiPanel fleet={fleet} selectedWell={analysis.selectedWell} language={language} t={t} />

            {/* Hidden Inputs */}
            <input type="file" ref={importDesignRef} className="hidden" accept=".json" multiple onChange={handleImportDesign} />
            <input type="file" ref={importDbRef} className="hidden" accept=".csv,.xlsx,.xls" onChange={handleImportDb} />
            
            {/* Overlay Progress */}
            {importProgress && (
                <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-canvas/90 backdrop-blur-3xl animate-fadeIn">
                    <div className="bg-surface/60 backdrop-blur-3xl border border-white/10 rounded-[4rem] p-16 shadow-[0_0_150px_rgba(var(--color-primary),0.2)] flex flex-col items-center gap-10 max-w-2xl w-full">
                        <div className="flex flex-col items-center w-full gap-4 text-center">
                            <h3 className="text-3xl font-black text-txt-main uppercase tracking-[0.3em]">{importProgress.label}</h3>
                            <div className="w-full mt-10 space-y-5">
                                <div className="w-full h-4 bg-canvas/60 rounded-full overflow-hidden border border-white/10 p-[3px]">
                                    <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${(importProgress.current / Math.max(1, importProgress.total)) * 100}%` }}></div>
                                </div>
                                <div className="flex justify-between items-end">
                                    <span className="text-[11px] font-black text-txt-muted uppercase">{importProgress.current} / {importProgress.total} Pozos</span>
                                    <span className="text-5xl font-black text-txt-main italic">{Math.round((importProgress.current / Math.max(1, importProgress.total)) * 100)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PhaseMonitoreo;
