
import { PipeData, EspPump, EspMotor, EspCable, EspVSD } from './types';

// Roughness 0.00065 ft (standard commercial steel tubing)
const DEFAULT_ROUGHNESS = 0.00065;

export const TUBING_CATALOG: PipeData[] = [
    { description: '2-3/8" 4.70# N-80', od: 2.375, id: 1.995, weight: 4.70, roughness: DEFAULT_ROUGHNESS },
    { description: '2-3/8" 4.60# J-55', od: 2.375, id: 1.995, weight: 4.60, roughness: DEFAULT_ROUGHNESS },
    { description: '2-7/8" 6.50# N-80', od: 2.875, id: 2.441, weight: 6.50, roughness: DEFAULT_ROUGHNESS },
    { description: '2-7/8" 6.40# J-55', od: 2.875, id: 2.441, weight: 6.40, roughness: DEFAULT_ROUGHNESS },
    { description: '3-1/2" 9.30# N-80', od: 3.500, id: 2.992, weight: 9.30, roughness: DEFAULT_ROUGHNESS },
    { description: '3-1/2" 9.20# J-55', od: 3.500, id: 2.992, weight: 9.20, roughness: DEFAULT_ROUGHNESS },
    { description: '4-1/2" 12.60# J-55', od: 4.500, id: 3.958, weight: 12.60, roughness: DEFAULT_ROUGHNESS },
];

export const CASING_CATALOG: PipeData[] = [
    { description: '4-1/2" 11.60# J-55', od: 4.500, id: 4.000, weight: 11.60, roughness: DEFAULT_ROUGHNESS },
    { description: '5-1/2" 15.50# K-55', od: 5.500, id: 4.950, weight: 15.50, roughness: DEFAULT_ROUGHNESS },
    { description: '5-1/2" 17.00# N-80', od: 5.500, id: 4.892, weight: 17.00, roughness: DEFAULT_ROUGHNESS },
    { description: '7" 23.00# K-55', od: 7.000, id: 6.366, weight: 23.00, roughness: DEFAULT_ROUGHNESS },
    { description: '7" 26.00# N-80', od: 7.000, id: 6.276, weight: 26.00, roughness: DEFAULT_ROUGHNESS },
    { description: '9-5/8" 40.00# N-80', od: 9.625, id: 8.835, weight: 40.00, roughness: DEFAULT_ROUGHNESS },
    { description: '9-5/8" 53.50# N-80', od: 9.625, id: 8.535, weight: 53.50, roughness: DEFAULT_ROUGHNESS },
];

export const CABLE_CATALOG: EspCable[] = [
    { id: 'cbl-1-flat', manufacturer: 'Generic', type: 'Flat', awg: '#1', model: '#1 AWG Flat EPDM/Lead', ohmsPer1000ft: 0.134, maxAmps: 165, weightPer1000ft: 1800 },
    { id: 'cbl-1-round', manufacturer: 'Generic', type: 'Round', awg: '#1', model: '#1 AWG Round EPDM/Lead', ohmsPer1000ft: 0.134, maxAmps: 180, weightPer1000ft: 2100 },
    { id: 'cbl-2-flat', manufacturer: 'Generic', type: 'Flat', awg: '#2', model: '#2 AWG Flat EPDM/Lead', ohmsPer1000ft: 0.170, maxAmps: 140, weightPer1000ft: 1500 },
    { id: 'cbl-2-round', manufacturer: 'Generic', type: 'Round', awg: '#2', model: '#2 AWG Round EPDM/Lead', ohmsPer1000ft: 0.170, maxAmps: 155, weightPer1000ft: 1800 },
    { id: 'cbl-4-flat', manufacturer: 'Generic', type: 'Flat', awg: '#4', model: '#4 AWG Flat EPDM/Lead', ohmsPer1000ft: 0.273, maxAmps: 105, weightPer1000ft: 1100 },
    { id: 'cbl-4-round', manufacturer: 'Generic', type: 'Round', awg: '#4', model: '#4 AWG Round EPDM/Lead', ohmsPer1000ft: 0.273, maxAmps: 115, weightPer1000ft: 1300 },
    { id: 'cbl-6-flat', manufacturer: 'Generic', type: 'Flat', awg: '#6', model: '#6 AWG Flat EPDM/Lead', ohmsPer1000ft: 0.436, maxAmps: 85, weightPer1000ft: 800 },
];

// --- VSD (Variable Speed Drive) SURFACE CATALOG ---
export const VSD_CATALOG: EspVSD[] = [
    // --- SCHLUMBERGER / SLB (REDA PowerCENT) ---
    { id: 'slb-pc-150', manufacturer: 'SLB', brand: 'REDA PowerCENT', model: 'PC-150', kvaRating: 150, inputVoltage: '460 / 600 V', outputVoltage: '0–600 V', outputFrequency: '5–120 Hz', thd: '<3%', efficiency: 97.5, cooling: 'Forced Air', enclosure: 'NEMA 3R', weight_kg: 680, notes: 'Flare-rated, suitable for offshore' },
    { id: 'slb-pc-300', manufacturer: 'SLB', brand: 'REDA PowerCENT', model: 'PC-300', kvaRating: 300, inputVoltage: '460 / 600 V', outputVoltage: '0–600 V', outputFrequency: '5–120 Hz', thd: '<3%', efficiency: 97.8, cooling: 'Forced Air', enclosure: 'NEMA 3R', weight_kg: 950, notes: 'Medium duty, oil & gas rated' },
    { id: 'slb-pc-500', manufacturer: 'SLB', brand: 'REDA PowerCENT', model: 'PC-500', kvaRating: 500, inputVoltage: '480 / 600 V', outputVoltage: '0–600 V', outputFrequency: '5–120 Hz', thd: '<3%', efficiency: 98.0, cooling: 'Forced Air', enclosure: 'NEMA 4X', weight_kg: 1250, notes: 'Heavy duty, redundant fans' },
    { id: 'slb-pc-1000', manufacturer: 'SLB', brand: 'REDA PowerCENT', model: 'PC-1000', kvaRating: 1000, inputVoltage: '480 / 600 V', outputVoltage: '0–4160 V', outputFrequency: '5–120 Hz', thd: '<3%', efficiency: 98.2, cooling: 'Liquid Cooled', enclosure: 'NEMA 4X', weight_kg: 2800, notes: 'High power, step-up transformer incl.' },
    // --- ABB (ACS880 ESP Series) ---
    { id: 'abb-acs880-75', manufacturer: 'ABB', brand: 'ACS880-ESP', model: 'ACS880-ESP-075', kvaRating: 75, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '0–120 Hz', thd: '<3% (filtered)', efficiency: 97.2, cooling: 'Forced Air', enclosure: 'IP54', weight_kg: 320, notes: 'DTC control, sensorless vector' },
    { id: 'abb-acs880-200', manufacturer: 'ABB', brand: 'ACS880-ESP', model: 'ACS880-ESP-200', kvaRating: 200, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '0–120 Hz', thd: '<3% (filtered)', efficiency: 97.8, cooling: 'Forced Air', enclosure: 'IP54', weight_kg: 580, notes: 'Direct Torque Control, ESP optimized' },
    { id: 'abb-acs880-400', manufacturer: 'ABB', brand: 'ACS880-ESP', model: 'ACS880-ESP-400', kvaRating: 400, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '0–120 Hz', thd: '<3% (filtered)', efficiency: 98.1, cooling: 'Forced Air', enclosure: 'IP54', weight_kg: 1100, notes: 'Advanced pump diagnostics built-in' },
    { id: 'abb-acs880-800', manufacturer: 'ABB', brand: 'ACS880-ESP', model: 'ACS880-ESP-800', kvaRating: 800, inputVoltage: '400–690 V', outputVoltage: '0–690 V', outputFrequency: '0–120 Hz', thd: '<4%', efficiency: 98.3, cooling: 'Liquid Cooled', enclosure: 'IP54', weight_kg: 2200, notes: 'MV option available' },
    // --- BAKER HUGHES (Centrilift CENTRiStar) ---
    { id: 'bh-cs-100', manufacturer: 'Baker Hughes', brand: 'CENTRiStar', model: 'CS-100', kvaRating: 100, inputVoltage: '460 / 575 V', outputVoltage: '0–575 V', outputFrequency: '10–120 Hz', thd: '<5%', efficiency: 97.0, cooling: 'Forced Air', enclosure: 'NEMA 3R', weight_kg: 420, notes: 'Harmonic filter option available' },
    { id: 'bh-cs-250', manufacturer: 'Baker Hughes', brand: 'CENTRiStar', model: 'CS-250', kvaRating: 250, inputVoltage: '460 / 575 V', outputVoltage: '0–575 V', outputFrequency: '10–120 Hz', thd: '<5%', efficiency: 97.5, cooling: 'Forced Air', enclosure: 'NEMA 3R', weight_kg: 780, notes: 'Integrated output reactor standard' },
    { id: 'bh-cs-600', manufacturer: 'Baker Hughes', brand: 'CENTRiStar', model: 'CS-600', kvaRating: 600, inputVoltage: '460 / 575 V', outputVoltage: '0–575 V', outputFrequency: '10–120 Hz', thd: '<5%', efficiency: 97.9, cooling: 'Forced Air', enclosure: 'NEMA 3R', weight_kg: 1600, notes: 'Skid-mounted, weather proof' },
    // --- SIEMENS (SINAMICS G120XA) ---
    { id: 'sie-g120xa-90', manufacturer: 'Siemens', brand: 'SINAMICS G120XA', model: 'G120XA-090', kvaRating: 90, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '0–120 Hz', thd: '<4%', efficiency: 97.0, cooling: 'Forced Air', enclosure: 'IP66', weight_kg: 280, notes: 'IEC rated, global voltage range' },
    { id: 'sie-g120xa-250', manufacturer: 'Siemens', brand: 'SINAMICS G120XA', model: 'G120XA-250', kvaRating: 250, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '0–120 Hz', thd: '<4%', efficiency: 97.7, cooling: 'Forced Air', enclosure: 'IP66', weight_kg: 680, notes: 'Integrated EMC filter, Modbus RTU' },
    { id: 'sie-g120xa-500', manufacturer: 'Siemens', brand: 'SINAMICS G120XA', model: 'G120XA-500', kvaRating: 500, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '0–120 Hz', thd: '<4%', efficiency: 98.0, cooling: 'Forced Air', enclosure: 'IP54', weight_kg: 1350, notes: 'SafetyIntegrated SIL2' },
    // --- FRANKLIN ELECTRIC (SubDrive ULTRA) ---
    { id: 'fe-su-50', manufacturer: 'Franklin Electric', brand: 'SubDrive ULTRA', model: 'ULTRA-050', kvaRating: 50, inputVoltage: '208–480 V', outputVoltage: '0–480 V', outputFrequency: '30–90 Hz', thd: '<8%', efficiency: 96.5, cooling: 'Forced Air', enclosure: 'NEMA 4', weight_kg: 120, notes: 'Compact, single-phase input option' },
    { id: 'fe-su-150', manufacturer: 'Franklin Electric', brand: 'SubDrive ULTRA', model: 'ULTRA-150', kvaRating: 150, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '30–90 Hz', thd: '<6%', efficiency: 97.0, cooling: 'Forced Air', enclosure: 'NEMA 4', weight_kg: 360, notes: 'Municipal & agriculture' },
    // --- CLESUS (Colombia — Distribuidor especializado) ---
    { id: 'clesus-100', manufacturer: 'CLESUS', brand: 'CLESUS VSD', model: 'CL-VSD-100', kvaRating: 100, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '5–120 Hz', thd: '<5%', efficiency: 97.0, cooling: 'Forced Air', enclosure: 'NEMA 3R', weight_kg: 380, notes: 'Soporte local Colombia — Piedemonte & Llanos' },
    { id: 'clesus-200', manufacturer: 'CLESUS', brand: 'CLESUS VSD', model: 'CL-VSD-200', kvaRating: 200, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '5–120 Hz', thd: '<5%', efficiency: 97.3, cooling: 'Forced Air', enclosure: 'NEMA 3R', weight_kg: 620, notes: 'Certificado para Zona 2 ATEX' },
    { id: 'clesus-300', manufacturer: 'CLESUS', brand: 'CLESUS VSD', model: 'CL-VSD-300', kvaRating: 300, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '5–120 Hz', thd: '<5%', efficiency: 97.5, cooling: 'Forced Air', enclosure: 'NEMA 3R', weight_kg: 850, notes: 'Configuración estándar para Casanare' },
    { id: 'clesus-320', manufacturer: 'CLESUS', brand: 'CLESUS VSD', model: 'CL-VSD-320', kvaRating: 320, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '5–120 Hz', thd: '<5%', efficiency: 97.5, cooling: 'Forced Air', enclosure: 'NEMA 3R', weight_kg: 900, notes: 'Variador Clesus 320 kVA' },
    { id: 'clesus-450', manufacturer: 'CLESUS', brand: 'CLESUS VSD', model: 'CL-VSD-450', kvaRating: 450, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '5–120 Hz', thd: '<5%', efficiency: 97.6, cooling: 'Forced Air', enclosure: 'NEMA 4X', weight_kg: 1050, notes: 'Alta potencia, skid personalizado' },

    // --- TRIOL (Rusia — Presencia en Colombia) ---
    { id: 'triol-at24-75', manufacturer: 'TRIOL', brand: 'TRIOL AT24', model: 'AT24-075', kvaRating: 75, inputVoltage: '380–480 V', outputVoltage: '0–600 V', outputFrequency: '1–120 Hz', thd: '<4%', efficiency: 96.8, cooling: 'Forced Air', enclosure: 'IP54', weight_kg: 290, notes: 'Control vectorial, autosintonía' },
    { id: 'triol-at24-150', manufacturer: 'TRIOL', brand: 'TRIOL AT24', model: 'AT24-150', kvaRating: 150, inputVoltage: '380–480 V', outputVoltage: '0–600 V', outputFrequency: '1–120 Hz', thd: '<4%', efficiency: 97.2, cooling: 'Forced Air', enclosure: 'IP54', weight_kg: 520, notes: 'Certificado Ex, diagnóstico ESP integrado' },
    { id: 'triol-at24-250', manufacturer: 'TRIOL', brand: 'TRIOL AT24', model: 'AT24-250', kvaRating: 250, inputVoltage: '380–480 V', outputVoltage: '0–600 V', outputFrequency: '1–120 Hz', thd: '<4%', efficiency: 97.5, cooling: 'Forced Air', enclosure: 'IP54', weight_kg: 780, notes: 'Versión robusta para yacimientos maduros' },
    { id: 'triol-at24-350', manufacturer: 'TRIOL', brand: 'TRIOL AT24', model: 'AT24-350', kvaRating: 350, inputVoltage: '380–480 V', outputVoltage: '0–600 V', outputFrequency: '1–120 Hz', thd: '<3%', efficiency: 97.8, cooling: 'Forced Air', enclosure: 'IP54', weight_kg: 940, notes: 'Protón vectorial, Modbus TCP/IP' },
    { id: 'triol-at24-600', manufacturer: 'TRIOL', brand: 'TRIOL AT24', model: 'AT24-600', kvaRating: 600, inputVoltage: '380–690 V', outputVoltage: '0–690 V', outputFrequency: '1–120 Hz', thd: '<3%', efficiency: 98.0, cooling: 'Liquid Cooled', enclosure: 'IP54', weight_kg: 1800, notes: 'Alta potencia, skid modular' },
    { id: 'triol-at27-400', manufacturer: 'TRIOL', brand: 'TRIOL AT27', model: 'AT27-400MV', kvaRating: 400, inputVoltage: '4160 V', outputVoltage: '0–4160 V', outputFrequency: '1–120 Hz', thd: '<3%', efficiency: 98.2, cooling: 'Forced Air', enclosure: 'NEMA 3R', weight_kg: 2200, notes: 'Medium Voltage Drive, multipulse input' },
    { id: 'triol-at27-800', manufacturer: 'TRIOL', brand: 'TRIOL AT27', model: 'AT27-800MV', kvaRating: 800, inputVoltage: '4160 V', outputVoltage: '0–4160 V', outputFrequency: '1–120 Hz', thd: '<3%', efficiency: 98.4, cooling: 'Forced Air', enclosure: 'NEMA 3R', weight_kg: 3500, notes: 'Alta eficiencia en media tensión' },

    // --- LS ELECTRIC (Premium series iS7 / iH) ---
    { id: 'ls-is7-125', manufacturer: 'LS ELECTRIC', brand: 'Starvert iS7', model: 'iS7-125', kvaRating: 125, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '0–400 Hz', thd: '<3%', efficiency: 97.5, cooling: 'Forced Air', enclosure: 'IP21/IP54', weight_kg: 85, notes: 'Premium Vector Drive, High Performance' },
    { id: 'ls-is7-250', manufacturer: 'LS ELECTRIC', brand: 'Starvert iS7', model: 'iS7-250', kvaRating: 250, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '0–400 Hz', thd: '<3%', efficiency: 97.8, cooling: 'Forced Air', enclosure: 'IP21/54', weight_kg: 145, notes: 'Dual-rated (CT/VT), built-in DC Reactor' },
    { id: 'ls-is7-500', manufacturer: 'LS ELECTRIC', brand: 'Starvert iS7', model: 'iS7-500', kvaRating: 500, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '0–400 Hz', thd: '<3%', efficiency: 98.1, cooling: 'Forced Air', enclosure: 'IP54', weight_kg: 320, notes: 'Sensorless & Vector Control ESP' },

    // --- LEX ENERGY / LEXPOWER (Distribuidos en Latam) ---
    { id: 'lex-ultra-200', manufacturer: 'LEX ENERGY', brand: 'LEX ULTRA', model: 'ULTRA-200', kvaRating: 200, inputVoltage: '480 V', outputVoltage: '0–480 V', outputFrequency: '5–120 Hz', thd: '<4%', efficiency: 97.2, cooling: 'Forced Air', enclosure: 'NEMA 3R', weight_kg: 450, notes: 'Diseño compacto para pozos de baja potencia' },
    { id: 'lex-ultra-400', manufacturer: 'LEX ENERGY', brand: 'LEX ULTRA', model: 'ULTRA-400', kvaRating: 400, inputVoltage: '480 V', outputVoltage: '0–480 V', outputFrequency: '5–120 Hz', thd: '<4%', efficiency: 97.5, cooling: 'Forced Air', enclosure: 'NEMA 3R', weight_kg: 820, notes: 'Optimizador de energía integrado' },
    { id: 'lex-ultra-750', manufacturer: 'LEX ENERGY', brand: 'LEX ULTRA', model: 'ULTRA-750', kvaRating: 750, inputVoltage: '480 V', outputVoltage: '0–480 V', outputFrequency: '5–120 Hz', thd: '<3%', efficiency: 97.9, cooling: 'Forced Air', enclosure: 'NEMA 4X', weight_kg: 1350, notes: 'Heavy duty, monitoreo remoto avanzado' },

    // --- INVERTEK (Optidrive P2 ESP - UK) ---
    { id: 'inv-p2-075', manufacturer: 'Invertek', brand: 'Optidrive P2', model: 'ODP-2-44075', kvaRating: 75, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '0–500 Hz', thd: '<5%', efficiency: 98.0, cooling: 'Forced Air', enclosure: 'IP66', weight_kg: 45, notes: 'ESP specific firmware, high switching frequency' },
    { id: 'inv-p2-150', manufacturer: 'Invertek', brand: 'Optidrive P2', model: 'ODP-2-54150', kvaRating: 150, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '0–500 Hz', thd: '<5%', efficiency: 98.2, cooling: 'Forced Air', enclosure: 'IP66', weight_kg: 85, notes: 'Outdoor rated, no extra cabinet needed' },
    { id: 'inv-p2-250', manufacturer: 'Invertek', brand: 'Optidrive P2', model: 'ODP-2-64250', kvaRating: 250, inputVoltage: '380–480 V', outputVoltage: '0–480 V', outputFrequency: '0–500 Hz', thd: '<5%', efficiency: 98.4, cooling: 'Forced Air', enclosure: 'IP66', weight_kg: 130, notes: 'PLC functions on-board' },

    // --- DANFOSS (VLT AutomationDrive FC 302 ESP) ---
    { id: 'dan-fc302-132', manufacturer: 'Danfoss', brand: 'VLT FC 302', model: 'FC-302-132KW', kvaRating: 165, inputVoltage: '380–500 V', outputVoltage: '0–500 V', outputFrequency: '0–590 Hz', thd: '<3%', efficiency: 98.0, cooling: 'Forced Air', enclosure: 'IP54', weight_kg: 125, notes: 'Sine-wave filter ready, low RFI' },
    { id: 'dan-fc302-315', manufacturer: 'Danfoss', brand: 'VLT FC 302', model: 'FC-302-315KW', kvaRating: 400, inputVoltage: '380–500 V', outputVoltage: '0–500 V', outputFrequency: '0–590 Hz', thd: '<3%', efficiency: 98.3, cooling: 'Forced Air', enclosure: 'IP54', weight_kg: 280, notes: 'Safe Torque Off (STO) SIL3' },
    { id: 'dan-fc302-630', manufacturer: 'Danfoss', brand: 'VLT FC 302', model: 'FC-302-630KW', kvaRating: 780, inputVoltage: '380–500 V', outputVoltage: '0–500 V', outputFrequency: '0–590 Hz', thd: '<3%', efficiency: 98.5, cooling: 'Liquid Cooled', enclosure: 'IP54', weight_kg: 620, notes: 'Extreme high power density' },
];

export const PUMP_DATABASE: EspPump[] = [];

// --- HELPER TO GENERATE GENERIC CURVE COEFFICIENTS (Simulated Data) ---
const genCurve = (maxHead: number, maxRate: number, hpFactor: number) => {
    return {
        h0: maxHead,
        h1: 0,
        h2: -maxHead / Math.pow(maxRate, 2),
        h3: 0, h4: 0, h5: 0, h6: 0,
        p0: hpFactor * 0.2,
        p1: (hpFactor * 0.8) / maxRate,
        p2: 0, p3: 0, p4: 0, p5: 0, p6: 0
    };
};

// --- HELPER TO GENERATE GENERIC MOTOR COEFFICIENTS ---
// Simulates typical Induction Motor curves relative to Load % (0-130)
const genMotorCoeffs = (baseHp: number) => {
    // RPM: 3600 sync, ~3450 at 100% load. Linear slip.
    // r = 3600 - 1.5*x
    const r = { r0: 3600, r1: -1.5, r2: 0, r3: 0, r4: 0, r5: 0 };

    // Amps %: ~30% magnetizing at 0 load, 100% at 100% load. Slightly non-linear.
    // a = 30 + 0.7*x + small quadratic? Linear is safe for simulation approx.
    const a = { a0: 30, a1: 0.7, a2: 0, a3: 0, a4: 0, a5: 0 };

    // PF: Low start, asymptotic to ~88 at 100%.
    // P = 90 * (1 - e^(-0.05*x))
    // Polynomial Approx of 1 - e^-x is 0 + x - x^2/2 ...
    // Using explicit points fit for 0-120 range:
    // 0:0, 20:50, 50:80, 100:88
    const p = { p0: 5, p1: 2.5, p2: -0.025, p3: 0.00008, p4: 0, p5: 0 }; // Rough shape

    // Eff: Rises fast, peaks at 70-80% load, stays flat-ish.
    // 0:0, 25:70, 50:85, 75:88, 100:87, 125:85
    const e = { e0: 0, e1: 3.5, e2: -0.045, e3: 0.00018, e4: 0, e5: 0 };

    return { ...r, ...a, ...p, ...e };
};

// --- STANDARD PUMP LIBRARY ---
export const STANDARD_PUMPS: EspPump[] = [];

// --- STANDARD MOTOR LIBRARY (IM - Induction Motors) ---
export const STANDARD_MOTORS: EspMotor[] = [];
