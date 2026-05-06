import { useState } from 'react';
import * as XLSX from 'xlsx';
import { WellFleetItem, SystemParams, EspPump, EspMotor, ProductionTest } from '@/types';
import { 
    s_ext, n_ext, d_ext, norm_ext, get_ext, smartMatchExt, fuzzyWellName 
} from '../utils/dataExtractors';

interface FileProcessingProps {
    pumpCatalog: EspPump[];
    motorCatalog: EspMotor[];
    setFleet: React.Dispatch<React.SetStateAction<WellFleetItem[]>>;
    setCustomDesigns: React.Dispatch<React.SetStateAction<Record<string, SystemParams>>>;
    setWellsHistoricalData: React.Dispatch<React.SetStateAction<Record<string, ProductionTest[]>>>;
}

export const useFileProcessing = ({
    pumpCatalog,
    motorCatalog,
    setFleet,
    setCustomDesigns,
    setWellsHistoricalData
}: FileProcessingProps) => {
    const [importProgress, setImportProgress] = useState<{ label: string; current: number; total: number } | null>(null);

    const processExcelDesignsBuffer = async (buffer: ArrayBuffer | string, isAutoLoad = false) => {
        try {
            setImportProgress({ label: "Analizando Estructura Excel...", current: 0, total: 100 });
            const workbook = XLSX.read(buffer, { type: typeof buffer === 'string' ? 'string' : 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json: any[] = XLSX.utils.sheet_to_json(sheet);

            if (json.length === 0) {
                if (!isAutoLoad) alert("El archivo Excel no contiene datos procesables.");
                setImportProgress(null);
                return;
            }

            setImportProgress({ label: "Mapeando Pozos y Equipos...", current: 0, total: json.length });

            const newFleet: WellFleetItem[] = [];
            const newDesigns: Record<string, SystemParams> = {};

            json.forEach((row, index) => {
                const wellNameRaw = get_ext(row, ['POZO', 'WELL', 'NOMBRES', 'NAME', 'WELL_NAME', 'WELLNAME']);
                if (!wellNameRaw) return;
                const wellName = String(wellNameRaw).trim();

                // Build Design Baseline
                const wellDesign: any = {
                    metadata: { wellName, date: d_ext(get_ext(row, ['FECHA', 'DATE', 'DATE OF TEST'])) },
                    wellbore: {
                        tubingBottom: n_ext(get_ext(row, ['PUMP DEPTH', 'PROFUNDIDAD BOMBA', 'PUMP_DEPTH', 'PROFUNDIDAD_BOMBA', 'MD PUMP'])),
                        midPerfsMD: n_ext(get_ext(row, ['PERFS', 'CAÑONEO', 'PERFORACIONES', 'PROFUNDIDAD_PERFS'])) || n_ext(get_ext(row, ['PUMP DEPTH'])) + 100
                    },
                    fluids: {
                        waterCut: n_ext(get_ext(row, ['BSW', 'WATER CUT', 'CORTE DE AGUA', 'CORTE AGUA'])),
                        apiOil: n_ext(get_ext(row, ['API', 'GRAVEDAD API', 'API OIL'])),
                        geGas: n_ext(get_ext(row, ['GE GAS', 'GAS GRAVITY', 'GRAVEDAD GAS'])),
                        gor: n_ext(get_ext(row, ['GOR', 'RGL', 'RELACION GAS ACEITE']))
                    },
                    inflow: {
                        pStatic: n_ext(get_ext(row, ['PSTATIC', 'PRESION ESTATICA', 'P_ESTATICA', 'PRESION_ESTATICA'])),
                        ip: n_ext(get_ext(row, ['IP', 'INDICE PRODUCTIVIDAD', 'PRODUCTIVITY INDEX', 'J'])) || 1.0
                    },
                    pressures: {
                        pht: n_ext(get_ext(row, ['THP', 'P-SURFACE', 'PHT', 'FHP', 'WHFP', 'PRESION CABEZA'])),
                        totalRate: n_ext(get_ext(row, ['BFPD', 'GROSS RATE', 'RATE', 'CAUDAL', 'TASA DE PRUEBA']))
                    }
                };

                // Smart match equipment
                const pumpModel = s_ext(get_ext(row, ['PUMP MODEL', 'MODELO BOMBA', 'BOMBA', 'PUMP']));
                const stages = n_ext(get_ext(row, ['STAGES', 'ETAPAS', 'NUMERO ETAPAS']));
                const matchedPump = smartMatchExt(pumpCatalog, pumpModel);
                if (matchedPump) {
                    wellDesign.selectedPump = { ...matchedPump, stages: stages || matchedPump.stages || 100 };
                }

                const motorModel = s_ext(get_ext(row, ['MOTOR MODEL', 'MODELO MOTOR', 'MOTOR']));
                const matchedMotor = smartMatchExt(motorCatalog, motorModel, true);
                if (matchedMotor) {
                    wellDesign.selectedMotor = matchedMotor;
                }

                const wellKey = wellName.toUpperCase();
                newDesigns[wellKey] = wellDesign;

                // Build Fleet Item
                newFleet.push({
                    id: `well-${index}-${Date.now()}`,
                    name: wellName,
                    status: 'normal',
                    currentRate: wellDesign.pressures.totalRate,
                    targetRate: wellDesign.pressures.totalRate,
                    health: { pump: 'normal', motor: 'normal', seal: 'normal', cable: 'normal', sensor: 'active' },
                    predictive: { ttf: 365, vsdStatus: 'optimal', vsdAnalysis: 'Stable', transformerStatus: 'optimal', transformerAnalysis: 'Normal', ventBoxStatus: 'optimal', ventBoxAnalysis: 'Clean' },
                    lastUpdate: new Date().toISOString(),
                    depthMD: wellDesign.wellbore.tubingBottom,
                    consumptionReal: n_ext(get_ext(row, ['AMPS', 'AMPERAJE', 'CURRENT'])) * 1.1, 
                    consumptionTheo: n_ext(get_ext(row, ['AMPS', 'AMPERAJE', 'CURRENT'])),
                    productionTest: {
                        date: wellDesign.metadata.date,
                        rate: wellDesign.pressures.totalRate,
                        freq: n_ext(get_ext(row, ['FRECUENCIA', 'FREQUENCY', 'HZ', 'Hz'])),
                        thp: wellDesign.pressures.pht,
                        waterCut: wellDesign.fluids.waterCut,
                        pip: n_ext(get_ext(row, ['PIP', 'INTAKE PRESSURE', 'PRESION SUCCION', 'PIN'])),
                        pdp: n_ext(get_ext(row, ['PDESC', 'DISCHARGE PRESSURE', 'PDP', 'P-DISCHARGE', 'PD'])),
                        gor: wellDesign.fluids.gor,
                        hp: 0,
                        hasMatchData: true
                    }
                });

                if (index % 10 === 0) setImportProgress(p => p ? { ...p, current: index } : null);
            });

            setFleet(newFleet);
            setCustomDesigns(newDesigns);
            setImportProgress(null);
            if (!isAutoLoad) alert(`Éxito: Se cargaron ${newFleet.length} diseños de pozo correctamente.`);

        } catch (err) {
            console.error("Error fatal en proceso Excel:", err);
            if (!isAutoLoad) alert("Error técnico al procesar el archivo Excel. Revise la consola.");
            setImportProgress(null);
        }
    };

    const processScadaBuffer = async (buffer: ArrayBuffer | string, isAutoLoad = false) => {
        try {
            setImportProgress({ label: "Sincronizando con Fleet Ops...", current: 0, total: 100 });
            const workbook = XLSX.read(buffer, { type: typeof buffer === 'string' ? 'string' : 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json: any[] = XLSX.utils.sheet_to_json(sheet);

            const newProductionData: Record<string, ProductionTest[]> = {};
            json.forEach(row => {
                const wellNameRaw = get_ext(row, ['POZO', 'WELL', 'NOMBRES', 'NAME', 'WELL_NAME']);
                if (!wellNameRaw) return;
                const wellName = String(wellNameRaw).trim();
                const wellKey = fuzzyWellName(wellName);

                const test: ProductionTest = {
                    date: d_ext(get_ext(row, ['FECHA', 'DATE', 'DATE OF TEST'])),
                    rate: n_ext(get_ext(row, ['BFPD', 'GROSS RATE', 'RATE', 'CAUDAL'])),
                    freq: n_ext(get_ext(row, ['FRECUENCIA', 'FREQUENCY', 'HZ', 'Hz'])) || 60,
                    thp: n_ext(get_ext(row, ['THP', 'P-SURFACE', 'PHT', 'PRESION CABEZA'])),
                    tht: n_ext(get_ext(row, ['THT', 'T-SURFACE', 'TEMP CABEZA'])) || 80,
                    waterCut: n_ext(get_ext(row, ['BSW', 'WATER CUT', 'CORTE DE AGUA'])),
                    pip: n_ext(get_ext(row, ['PIP', 'INTAKE PRESSURE', 'PI P', 'PRESION SUCCION'])),
                    pdp: n_ext(get_ext(row, ['PDESC', 'DISCHARGE PRESSURE', 'PDP', 'P-DISCHARGE'])),
                    gor: 0, hp: 0, hasMatchData: true
                };

                if (!newProductionData[wellKey]) newProductionData[wellKey] = [];
                newProductionData[wellKey].push(test);
            });

            let matchCount = 0;
            setFleet(prev => {
                return prev.map(well => {
                    const wellKey = fuzzyWellName(well.name);
                    const tests = newProductionData[wellKey];
                    if (tests && tests.length > 0) {
                        matchCount++;
                        const latest = tests[tests.length - 1];
                        return {
                            ...well,
                            currentRate: latest.rate,
                            lastUpdate: latest.date,
                            productionTest: latest
                        };
                    }
                    return well;
                });
            });

            setCustomDesigns(prev => {
                const updated = { ...prev };
                Object.entries(newProductionData).forEach(([wellKey, tests]) => {
                    const latest = tests[tests.length - 1];
                    const targetKey = Object.keys(updated).find(k => fuzzyWellName(k) === wellKey);
                    if (targetKey) {
                        updated[targetKey] = {
                            ...updated[targetKey],
                            metadata: { ...updated[targetKey].metadata, date: latest.date },
                            historyMatch: {
                                rate: latest.rate, frequency: latest.freq, thp: latest.thp, pip: latest.pip, pdp: latest.pdp,
                                waterCut: latest.waterCut, matchDate: latest.date, startDate: latest.date, tht: latest.tht || 80,
                                hp: 0, gor: 0, pd: latest.pdp, fluidLevel: 0, submergence: 0, pStatic: updated[targetKey].inflow.pStatic
                            }
                        };
                    }
                });
                return updated;
            });

            setWellsHistoricalData(prev => {
                const updated = { ...prev };
                Object.entries(newProductionData).forEach(([wellKey, tests]) => {
                    updated[wellKey] = tests;
                });
                return updated;
            });

            if (!isAutoLoad) {
                if (matchCount > 0) alert(`Éxito: Se sincronizaron datos para ${matchCount} pozos.`);
                else alert("Atención: No se encontraron coincidencias entre el Excel y la flota actual.");
            }
            setImportProgress(null);

        } catch (err) {
            console.error("[SCADA Import] Error fatal:", err);
            if (!isAutoLoad) alert("Error técnico al procesar el archivo SCADA.");
            setImportProgress(null);
        }
    };

    return {
        importProgress,
        processExcelDesignsBuffer,
        processScadaBuffer
    };
};
