
import React, { useState, useRef, useMemo } from 'react';
import { X, Upload, Save, FileJson, Activity, Zap, BarChart3, Settings, FileSpreadsheet, Search, ChevronRight, Database, DownloadCloud, Server, ArrowUpCircle } from 'lucide-react';
import { read, utils } from 'xlsx';
import { EspPump, EspMotor, SystemParams } from '../types';
import { useLanguage } from '../i18n';

interface PumpImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (pump: EspPump | null, motorHp: number, fullPumpCatalog?: EspPump[], fullMotorCatalog?: EspMotor[]) => void;
    onImportProject?: (data: { params: SystemParams, customPump: EspPump | null, frequency: number }) => void;
    initialPump: EspPump | null;
    initialMotorHp: number;
}

const DEFAULT_PUMP: EspPump = {
    id: 'default',
    manufacturer: '',
    series: '',
    model: '',
    stages: 0,
    housingCount: 1,
    minStages: 1,
    maxStages: 100,
    stageIncrease: 1,
    minRate: 0,
    bepRate: 0,
    maxRate: 0,
    maxEfficiency: 0,
    maxHead: 0,
    maxGraphRate: 0,
    nameplateFrequency: 60,
    h0: 0, h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0,
    p0: 0, p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0
};

export const PumpImportModal: React.FC<PumpImportModalProps> = ({ isOpen, onClose, onSave, onImportProject, initialPump, initialMotorHp }) => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState<EspPump>(initialPump || DEFAULT_PUMP);
    const [motorHp, setMotorHp] = useState<number>(initialMotorHp || 0);

    // Lists
    const [importedPumps, setImportedPumps] = useState<EspPump[]>([]);
    const [importedMotors, setImportedMotors] = useState<EspMotor[]>([]);

    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredPumps = useMemo(() => {
        const validPumps = importedPumps.filter(p => p && p.id);
        if (!searchTerm) return validPumps;
        const lower = searchTerm.toLowerCase();
        return validPumps.filter(p =>
            (p.model || '').toLowerCase().includes(lower) ||
            (p.series || '').toLowerCase().includes(lower) ||
            (p.manufacturer || '').toLowerCase().includes(lower)
        );
    }, [importedPumps, searchTerm]);

    if (!isOpen) return null;

    const normalizeKey = (key: string) => String(key).toLowerCase().trim().replace(/[\s\-_]/g, '');

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isJson = file.name.toLowerCase().endsWith('.json');
        const isExcel = file.name.toLowerCase().match(/\.(xlsx|xls)$/);

        if (isJson) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const json = JSON.parse(event.target?.result as string);

                    if (json.type === 'esp-studio-project' && json.data) {
                        if (onImportProject) {
                            onImportProject(json.data);
                            onClose();
                            return;
                        }
                    }

                    if (Array.isArray(json)) {
                        setImportedPumps(json.filter((p: any) => p && p.id));
                    } else if (json.pumps && Array.isArray(json.pumps)) {
                        setImportedPumps(json.pumps.filter((p: any) => p && p.id));
                        if (json.motors) setImportedMotors(json.motors.filter((m: any) => m && m.id));
                    } else if (json.manufacturer) {
                        setFormData({ ...DEFAULT_PUMP, ...json });
                        setImportedPumps([]);
                    }
                } catch (err) {
                    alert("Error parsing JSON.");
                }
            };
            reader.readAsText(file);
        } else if (isExcel) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target?.result as ArrayBuffer);
                    const workbook = read(data, { type: 'array' });

                    let pumpSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('pump'));
                    if (!pumpSheetName) pumpSheetName = workbook.SheetNames[0];

                    const pumpSheet = workbook.Sheets[pumpSheetName];
                    const pumpJson = utils.sheet_to_json(pumpSheet, { header: 1 }) as any[][];

                    const pumps: EspPump[] = [];
                    let pHeaderIdx = -1;
                    for (let i = 0; i < Math.min(pumpJson.length, 20); i++) {
                        const row = pumpJson[i].map(c => normalizeKey(c));
                        // Check for critical columns to identify the header row
                        if ((row.includes('model') || row.includes('series')) && (row.includes('h0') || row.includes('minrate'))) {
                            pHeaderIdx = i; break;
                        }
                    }

                    if (pHeaderIdx !== -1) {
                        const headers = pumpJson[pHeaderIdx].map(c => normalizeKey(c));
                        for (let i = pHeaderIdx + 1; i < pumpJson.length; i++) {
                            const row = pumpJson[i];
                            if (!row || row.length === 0) continue;
                            const p: any = { ...DEFAULT_PUMP, id: crypto.randomUUID() };
                            let valid = false;
                            headers.forEach((key, col) => {
                                const val = row[col];
                                if (val === undefined || val === null || val === '') return;

                                // Map Columns
                                if (key === 'manufacturer') p.manufacturer = String(val);
                                else if (key === 'series') p.series = String(val);
                                else if (key === 'model') p.model = String(val);
                                else if (key === 'minrate') p.minRate = Number(val);
                                else if (key === 'beprate') p.bepRate = Number(val);
                                else if (key === 'maxrate') p.maxRate = Number(val);
                                else if (key === 'maxefficiency') p.maxEfficiency = Number(val);
                                else if (key === 'frequency' || key === 'hz' || key === 'nameplatefrequency') p.nameplateFrequency = Number(val);

                                // --- NEW STAGE LIMIT COLUMNS ---
                                else if (key === 'minstages') p.minStages = Number(val);
                                else if (key === 'maxstages') p.maxStages = Number(val);
                                else if (key === 'stageincrease') p.stageIncrease = Number(val);

                                // Coefficients
                                else if (['h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'].includes(key)) {
                                    p[key] = Number(val);
                                    if (Number(val) !== 0) valid = true;
                                }
                            });

                            // Sanity Check & Defaults
                            if (p.model && valid) {
                                if (!p.stages) p.stages = 1; // Default
                                if (!p.maxRate && p.minRate) p.maxRate = p.minRate * 2;
                                if (!p.bepRate) p.bepRate = (p.minRate + p.maxRate) / 2;
                                if (!p.maxEfficiency) p.maxEfficiency = 70;
                                if (!p.maxGraphRate) p.maxGraphRate = p.maxRate * 1.2;
                                if (!p.nameplateFrequency) p.nameplateFrequency = 60;

                                // Set defaults for stages if Excel didn't have them
                                if (!p.maxStages) p.maxStages = 100; // Safe default per body
                                if (!p.minStages) p.minStages = 1;
                                if (!p.stageIncrease) p.stageIncrease = 1;

                                // Calculate initial bodies needed for current stages
                                p.housingCount = Math.ceil(p.stages / p.maxStages);

                                pumps.push(p);
                            }
                        }
                    }

                    const motors: EspMotor[] = [];
                    let motorSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('motor'));
                    if (motorSheetName) {
                        const motorSheet = workbook.Sheets[motorSheetName];
                        const motorJson = utils.sheet_to_json(motorSheet, { header: 1 }) as any[][];
                        let mHeaderIdx = -1;
                        for (let i = 0; i < Math.min(motorJson.length, 20); i++) {
                            const row = motorJson[i].map(c => normalizeKey(c));
                            if (row.includes('nameplatehp') || (row.includes('nameplatevoltage'))) {
                                mHeaderIdx = i; break;
                            }
                        }
                        if (mHeaderIdx !== -1) {
                            const mHeaders = motorJson[mHeaderIdx].map(c => normalizeKey(c));
                            for (let i = mHeaderIdx + 1; i < motorJson.length; i++) {
                                const row = motorJson[i];
                                if (!row || row.length === 0) continue;
                                const m: any = { id: crypto.randomUUID(), manufacturer: 'Generic', series: 'STD', model: 'Motor', hp: 0, voltage: 0, amps: 0 };
                                mHeaders.forEach((key, col) => {
                                    const val = row[col];
                                    if (val === undefined || val === null) return;
                                    if (key === 'nameplatehp') m.hp = Number(val);
                                    else if (key === 'nameplatevoltage') m.voltage = Number(val);
                                    else if (key === 'nameplatecurrent') m.amps = Number(val);
                                    else if (key === 'manufacturer') m.manufacturer = String(val);
                                    else if (key === 'series') m.series = String(val);
                                    else if (key === 'type') m.model = String(val);
                                });
                                if (m.hp > 0) motors.push(m);
                            }
                        }
                    }

                    // Fallback motors if sheet empty
                    if (motors.length === 0) {
                        [30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000].forEach(hp => {
                            motors.push({
                                id: `std-${hp}`, manufacturer: 'Generic', series: '456', model: `${hp}HP-STD`,
                                hp: hp, voltage: hp * 10, amps: (hp * 746) / (Math.sqrt(3) * (hp * 10) * 0.85 * 0.85)
                            });
                        });
                    }

                    if (pumps.length > 0) {
                        setImportedPumps(pumps);
                        setImportedMotors(motors);
                        setSearchTerm('');
                    } else {
                        alert("No valid pumps found. Check format.");
                    }

                } catch (err) {
                    console.error(err);
                    alert("Error processing Excel file.");
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            alert("Unsupported format. Use .json, .xls or .xlsx");
        }
    };

    const handleImportCatalog = () => {
        onSave(null, motorHp, importedPumps.filter(p => p && p.id), importedMotors.filter(m => m && m.id));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
            <div className="bg-slate-900 w-full max-w-5xl h-[90vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden border border-slate-800 relative">

                {/* Decorative Light */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>

                {/* Header */}
                <div className="p-8 border-b border-slate-800 flex justify-between items-center z-10 bg-slate-900/50">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600/20 border border-blue-500/50 p-3 rounded-2xl text-blue-400">
                            <Settings className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">Database Manager</h2>
                            <p className="text-xs font-bold text-slate-500 uppercase">
                                {importedPumps.length > 0 ? `Catalog Loaded: ${importedPumps.length} Pumps | ${importedMotors.length} Motors` : 'Import Catalog / Project File'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-800 rounded-full transition-colors text-slate-500 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-950/50">

                    {/* MODE: CATALOG BROWSER */}
                    {importedPumps.length > 0 ? (
                        <div className="h-full flex flex-col space-y-4 animate-fadeIn">
                            <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm sticky top-0 z-20">
                                <Search className="w-5 h-5 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder={t('p5.filter')}
                                    className="flex-1 bg-transparent outline-none font-bold text-slate-300 placeholder:text-slate-600 uppercase text-sm"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <button onClick={() => { setImportedPumps([]); setImportedMotors([]); }} className="text-xs font-bold text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-colors uppercase border border-red-900/50">
                                        Reset
                                    </button>
                                    <button onClick={handleImportCatalog} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg shadow-emerald-900/20">
                                        <DownloadCloud className="w-4 h-4" />
                                        Confirm Database
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
                                <div className="col-span-2 bg-slate-900 rounded-3xl border border-slate-800 flex flex-col overflow-hidden">
                                    <div className="bg-slate-950/50 p-3 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase flex justify-between items-center">
                                        <span>Pumps Identified ({filteredPumps.length})</span>
                                        <Database className="w-3 h-3 text-slate-600" />
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-950 sticky top-0 z-10">
                                                <tr>
                                                    <th className="p-3 text-[9px] font-black text-slate-500 uppercase">Manufacturer</th>
                                                    <th className="p-3 text-[9px] font-black text-slate-500 uppercase">Model</th>
                                                    <th className="p-3 text-[9px] font-black text-slate-500 uppercase">Range (BPD)</th>
                                                    <th className="p-3 text-[9px] font-black text-slate-500 uppercase">Max Stg/Body</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/50">
                                                {filteredPumps.map((pump) => pump && (
                                                    <tr key={pump.id || Math.random()} className="hover:bg-slate-800/50 transition-colors">
                                                        <td className="p-3 text-xs font-bold text-slate-400">{pump.manufacturer}</td>
                                                        <td className="p-3 text-sm font-black text-slate-200">{pump.model} <span className="text-slate-600 text-xs font-normal">{pump.series}</span></td>
                                                        <td className="p-3 text-xs font-mono text-slate-500">{pump.minRate} - {pump.maxRate}</td>
                                                        <td className="p-3 text-xs font-mono text-emerald-500">{pump.maxStages || 100}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="bg-slate-900 rounded-3xl border border-slate-800 flex flex-col overflow-hidden">
                                    <div className="bg-slate-950/50 p-3 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase flex justify-between items-center">
                                        <span>Motors Identified ({importedMotors.length})</span>
                                        <Zap className="w-3 h-3 text-slate-600" />
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                                        {importedMotors.slice(0, 50).map(m => m && (
                                            <div key={m.id || Math.random()} className="flex justify-between items-center text-xs font-bold text-slate-400 border-b border-slate-800 pb-2 mb-1 last:border-0">
                                                <span>{m.hp} HP</span>
                                                <div className="flex gap-2">
                                                    <span className="text-slate-500 bg-slate-950 px-2 py-0.5 rounded">{m.voltage} V</span>
                                                    <span className="text-slate-500 bg-slate-950 px-2 py-0.5 rounded">{m.amps} A</span>
                                                </div>
                                            </div>
                                        ))}
                                        {importedMotors.length > 50 && <div className="text-center text-[10px] text-slate-600 pt-2 border-t border-slate-800">... and {importedMotors.length - 50} more</div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* MODE: UPLOAD */
                        <div className="flex flex-col items-center justify-center h-full animate-fadeIn">
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept=".json, .xlsx, .xls"
                                className="hidden"
                                onChange={handleFileUpload}
                            />

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="group relative bg-slate-900 hover:bg-slate-800 w-full max-w-2xl aspect-[2/1] rounded-[40px] border-2 border-dashed border-slate-700 hover:border-blue-500 transition-all flex flex-col items-center justify-center gap-6 group overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform border border-slate-700 group-hover:border-blue-500 shadow-xl">
                                    <ArrowUpCircle className="w-12 h-12 text-slate-500 group-hover:text-blue-500 transition-colors" />
                                </div>
                                <div className="text-center space-y-2 relative z-10">
                                    <h3 className="text-3xl font-black text-white uppercase tracking-tight">Upload Database</h3>
                                    <p className="text-slate-500 font-medium">Drag & Drop or Click to browse <br /> <span className="text-blue-500">Excel (.xlsx)</span> or JSON</p>
                                </div>
                                <div className="absolute bottom-10 flex gap-4 opacity-50 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                                        <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Excel
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                                        <FileJson className="w-4 h-4 text-yellow-500" /> JSON
                                    </div>
                                </div>
                            </button>

                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
