
import { PipeData, EspPump, EspMotor } from './types';

// Roughness 0.000065 ft (standard commercial steel tubing ~ 0.00078 inches)
const DEFAULT_ROUGHNESS = 0.000065; 

export const TUBING_CATALOG: PipeData[] = [
  { description: '2-3/8" 4.60# J-55', od: 2.375, id: 1.995, weight: 4.60, roughness: DEFAULT_ROUGHNESS },
  { description: '2-3/8" 4.70# N-80', od: 2.375, id: 1.995, weight: 4.70, roughness: DEFAULT_ROUGHNESS },
  { description: '2-7/8" 6.40# J-55', od: 2.875, id: 2.441, weight: 6.40, roughness: DEFAULT_ROUGHNESS },
  { description: '2-7/8" 6.50# N-80', od: 2.875, id: 2.441, weight: 6.50, roughness: DEFAULT_ROUGHNESS },
  { description: '3-1/2" 9.20# J-55', od: 3.500, id: 2.992, weight: 9.20, roughness: DEFAULT_ROUGHNESS },
  { description: '3-1/2" 9.30# N-80', od: 3.500, id: 2.992, weight: 9.30, roughness: DEFAULT_ROUGHNESS },
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

export const PUMP_DATABASE: EspPump[] = [];

// --- HELPER TO GENERATE GENERIC CURVE COEFFICIENTS (Simulated Data) ---
const genCurve = (maxHead: number, maxRate: number, hpFactor: number) => {
    return {
        h0: maxHead,
        h1: 0,
        h2: -maxHead / Math.pow(maxRate, 2),
        h3: 0, h4: 0, h5: 0,
        p0: hpFactor * 0.2,
        p1: (hpFactor * 0.8) / maxRate,
        p2: 0, p3: 0, p4: 0, p5: 0
    };
};

// --- STANDARD PUMP LIBRARY ---
export const STANDARD_PUMPS: EspPump[] = [
    // --- REDA (SLB) Style ---
    { 
        id: 'reda-dn1100', manufacturer: 'REDA', series: '338', model: 'DN1100', stages: 1, 
        minRate: 600, bepRate: 1100, maxRate: 1600, maxEfficiency: 68, maxHead: 0, maxGraphRate: 1800, nameplateFrequency: 60,
        ...genCurve(24, 1800, 0.25)
    },
    { 
        id: 'reda-dn1750', manufacturer: 'REDA', series: '400', model: 'DN1750', stages: 1, 
        minRate: 1200, bepRate: 1750, maxRate: 2300, maxEfficiency: 70, maxHead: 0, maxGraphRate: 2500, nameplateFrequency: 60,
        ...genCurve(32, 2600, 0.45)
    },
    { 
        id: 'reda-gn4000', manufacturer: 'REDA', series: '538', model: 'GN4000', stages: 1, 
        minRate: 2800, bepRate: 4000, maxRate: 5200, maxEfficiency: 74, maxHead: 0, maxGraphRate: 6000, nameplateFrequency: 60,
        ...genCurve(45, 6500, 1.2)
    },
    { 
        id: 'reda-gn7000', manufacturer: 'REDA', series: '538', model: 'GN7000', stages: 1, 
        minRate: 4500, bepRate: 7000, maxRate: 9000, maxEfficiency: 75, maxHead: 0, maxGraphRate: 10000, nameplateFrequency: 60,
        ...genCurve(55, 11000, 2.1)
    },
    { 
        id: 'reda-j14000', manufacturer: 'REDA', series: '675', model: 'J14000', stages: 1, 
        minRate: 9000, bepRate: 14000, maxRate: 18000, maxEfficiency: 78, maxHead: 0, maxGraphRate: 20000, nameplateFrequency: 60,
        ...genCurve(65, 22000, 4.5)
    },

    // --- BAKER HUGHES Style ---
    { 
        id: 'baker-p10', manufacturer: 'Baker', series: '338', model: 'P10', stages: 1, 
        minRate: 400, bepRate: 1000, maxRate: 1400, maxEfficiency: 66, maxHead: 0, maxGraphRate: 1600, nameplateFrequency: 60,
        ...genCurve(22, 1600, 0.2)
    },
    { 
        id: 'baker-gc2200', manufacturer: 'Baker', series: '400', model: 'GC2200', stages: 1, 
        minRate: 1500, bepRate: 2200, maxRate: 3000, maxEfficiency: 71, maxHead: 0, maxGraphRate: 3500, nameplateFrequency: 60,
        ...genCurve(35, 3600, 0.6)
    },
    { 
        id: 'baker-fc4500', manufacturer: 'Baker', series: '538', model: 'FC4500', stages: 1, 
        minRate: 3000, bepRate: 4500, maxRate: 6000, maxEfficiency: 73, maxHead: 0, maxGraphRate: 6800, nameplateFrequency: 60,
        ...genCurve(48, 7000, 1.4)
    },
    { 
        id: 'baker-g6000', manufacturer: 'Baker', series: '538', model: 'G6000', stages: 1, 
        minRate: 4000, bepRate: 6000, maxRate: 8000, maxEfficiency: 74, maxHead: 0, maxGraphRate: 9000, nameplateFrequency: 60,
        ...genCurve(52, 9500, 1.8)
    },

    // --- NOVOMET Style ---
    { 
        id: 'novo-vn500', manufacturer: 'Novomet', series: '362', model: 'VN500', stages: 1, 
        minRate: 300, bepRate: 500, maxRate: 800, maxEfficiency: 64, maxHead: 0, maxGraphRate: 1000, nameplateFrequency: 50,
        ...genCurve(18, 1100, 0.15)
    },
    { 
        id: 'novo-vn1500', manufacturer: 'Novomet', series: '406', model: 'VN1500', stages: 1, 
        minRate: 1000, bepRate: 1500, maxRate: 2200, maxEfficiency: 69, maxHead: 0, maxGraphRate: 2500, nameplateFrequency: 50,
        ...genCurve(28, 2800, 0.4)
    },
    { 
        id: 'novo-vn5000', manufacturer: 'Novomet', series: '512', model: 'VN5000', stages: 1, 
        minRate: 3500, bepRate: 5000, maxRate: 7000, maxEfficiency: 75, maxHead: 0, maxGraphRate: 8000, nameplateFrequency: 50,
        ...genCurve(50, 8500, 1.6)
    },

    // --- BORETS Style ---
    { 
        id: 'borets-e2500', manufacturer: 'Borets', series: '400', model: 'E2500', stages: 1, 
        minRate: 1800, bepRate: 2500, maxRate: 3200, maxEfficiency: 70, maxHead: 0, maxGraphRate: 3800, nameplateFrequency: 60,
        ...genCurve(38, 4000, 0.7)
    },
    { 
        id: 'borets-e6000', manufacturer: 'Borets', series: '538', model: 'E6000', stages: 1, 
        minRate: 4200, bepRate: 6000, maxRate: 7800, maxEfficiency: 74, maxHead: 0, maxGraphRate: 9000, nameplateFrequency: 60,
        ...genCurve(53, 9500, 1.9)
    },

    // --- ALKHORAYEF (ACP) Style ---
    { 
        id: 'acp-p3000', manufacturer: 'ACP', series: '400', model: 'P3000', stages: 1, 
        minRate: 2000, bepRate: 3000, maxRate: 4000, maxEfficiency: 71, maxHead: 0, maxGraphRate: 4500, nameplateFrequency: 60,
        ...genCurve(40, 4800, 0.9)
    },
];

// --- STANDARD MOTOR LIBRARY (IM - Induction Motors) ---
export const STANDARD_MOTORS: EspMotor[] = [
    // --- APC (Alkhorayef) 560 Series - Requested by User ---
    { id: 'apc-560-391-3033', manufacturer: 'APC', series: '560', model: 'XCeeD XT1-S 391HP', hp: 391, voltage: 3033, amps: 78.3 },
    { id: 'apc-560-391-2533', manufacturer: 'APC', series: '560', model: 'XCeeD XT1-S 391HP', hp: 391, voltage: 2533, amps: 92.6 },
    { id: 'apc-560-391-2027', manufacturer: 'APC', series: '560', model: 'XCeeD XT1-S 391HP', hp: 391, voltage: 2027, amps: 115.6 },
    { id: 'apc-560-391-1774', manufacturer: 'APC', series: '560', model: 'XCeeD XT1-S 391HP', hp: 391, voltage: 1774, amps: 132.8 },
    { id: 'apc-560-391-1454', manufacturer: 'APC', series: '560', model: 'XCeeD XT1-S 391HP', hp: 391, voltage: 1454, amps: 160.8 },
    { id: 'apc-560-390-4050', manufacturer: 'APC', series: '560', model: 'XCeeD XT1-T 390HP', hp: 390, voltage: 4050, amps: 57.8 },
    { id: 'apc-560-390-3685', manufacturer: 'APC', series: '560', model: 'XCeeD XT2-S 390HP', hp: 390, voltage: 3685, amps: 64.0 },
    { id: 'apc-560-390-3549', manufacturer: 'APC', series: '560', model: 'XCeeD XT1-T 390HP', hp: 390, voltage: 3549, amps: 66.9 },

    // --- REDA (Schlumberger) 456 Series ---
    { id: 'reda-456-60-780', manufacturer: 'REDA', series: '456', model: '456 Series 60HP', hp: 60, voltage: 780, amps: 52 },
    { id: 'reda-456-75-975', manufacturer: 'REDA', series: '456', model: '456 Series 75HP', hp: 75, voltage: 975, amps: 52 },
    { id: 'reda-456-100-1100', manufacturer: 'REDA', series: '456', model: '456 Series 100HP', hp: 100, voltage: 1100, amps: 58 },
    { id: 'reda-456-120-1320', manufacturer: 'REDA', series: '456', model: '456 Series 120HP', hp: 120, voltage: 1320, amps: 58 },
    { id: 'reda-456-150-1460', manufacturer: 'REDA', series: '456', model: '456 Series 150HP', hp: 150, voltage: 1460, amps: 65 },
    { id: 'reda-456-180-1750', manufacturer: 'REDA', series: '456', model: '456 Series 180HP', hp: 180, voltage: 1750, amps: 65 },
    { id: 'reda-456-200-2100', manufacturer: 'REDA', series: '456', model: '456 Series 200HP (Tandem)', hp: 200, voltage: 2100, amps: 60 },
    
    // --- BAKER HUGHES (Centrilift) 450 Series ---
    { id: 'baker-450-30-460', manufacturer: 'Baker', series: '450', model: 'Centrilift 450 30HP', hp: 30, voltage: 460, amps: 41 },
    { id: 'baker-450-40-460', manufacturer: 'Baker', series: '450', model: 'Centrilift 450 40HP', hp: 40, voltage: 460, amps: 54 },
    { id: 'baker-450-50-840', manufacturer: 'Baker', series: '450', model: 'Centrilift 450 50HP', hp: 50, voltage: 840, amps: 37 },
    { id: 'baker-450-60-840', manufacturer: 'Baker', series: '450', model: 'Centrilift 450 60HP', hp: 60, voltage: 840, amps: 45 },
    { id: 'baker-450-75-1015', manufacturer: 'Baker', series: '450', model: 'Centrilift 450 75HP', hp: 75, voltage: 1015, amps: 45 },
    { id: 'baker-450-100-1100', manufacturer: 'Baker', series: '450', model: 'Centrilift 450 100HP', hp: 100, voltage: 1100, amps: 56 },
    { id: 'baker-450-125-1360', manufacturer: 'Baker', series: '450', model: 'Centrilift 450 125HP', hp: 125, voltage: 1360, amps: 56 },
    
    // --- BAKER HUGHES (Centrilift) 562 Series ---
    { id: 'baker-562-150-1050', manufacturer: 'Baker', series: '562', model: 'Centrilift 562 150HP', hp: 150, voltage: 1050, amps: 88 },
    { id: 'baker-562-200-1400', manufacturer: 'Baker', series: '562', model: 'Centrilift 562 200HP', hp: 200, voltage: 1400, amps: 88 },
    { id: 'baker-562-250-1750', manufacturer: 'Baker', series: '562', model: 'Centrilift 562 250HP', hp: 250, voltage: 1750, amps: 88 },
    { id: 'baker-562-300-2100', manufacturer: 'Baker', series: '562', model: 'Centrilift 562 300HP', hp: 300, voltage: 2100, amps: 88 },
    { id: 'baker-562-400-2300', manufacturer: 'Baker', series: '562', model: 'Centrilift 562 400HP', hp: 400, voltage: 2300, amps: 105 },

    // --- NOVOMET 406 Series (Typical IM) ---
    { id: 'novo-406-40-700', manufacturer: 'Novomet', series: '406', model: 'Novomet 406 40HP', hp: 40, voltage: 700, amps: 36 },
    { id: 'novo-406-63-1000', manufacturer: 'Novomet', series: '406', model: 'Novomet 406 63HP', hp: 63, voltage: 1000, amps: 40 },
    { id: 'novo-406-80-1200', manufacturer: 'Novomet', series: '406', model: 'Novomet 406 80HP', hp: 80, voltage: 1200, amps: 42 },
    { id: 'novo-406-100-1500', manufacturer: 'Novomet', series: '406', model: 'Novomet 406 100HP', hp: 100, voltage: 1500, amps: 42 },
    // Novomet High Voltage / Hi-Temp
    { id: 'novo-512-120-2000', manufacturer: 'Novomet', series: '512', model: 'Novomet 512 120HP HV', hp: 120, voltage: 2000, amps: 41 },
    { id: 'novo-512-160-2300', manufacturer: 'Novomet', series: '512', model: 'Novomet 512 160HP HV', hp: 160, voltage: 2300, amps: 48 },

    // --- BORETS (Weatherford Legacy) ---
    { id: 'borets-456-60-850', manufacturer: 'Borets', series: '456', model: 'Borets 456 60HP', hp: 60, voltage: 850, amps: 45 },
    { id: 'borets-456-90-1100', manufacturer: 'Borets', series: '456', model: 'Borets 456 90HP', hp: 90, voltage: 1100, amps: 52 },
    { id: 'borets-540-150-1350', manufacturer: 'Borets', series: '540', model: 'Borets 540 150HP', hp: 150, voltage: 1350, amps: 70 },

    // --- ALKHORAYEF (ACP) / GENERIC IM ---
    { id: 'acp-456-50-650', manufacturer: 'ACP', series: '456', model: 'ACP 456 IM 50HP', hp: 50, voltage: 650, amps: 48 },
    { id: 'acp-456-75-950', manufacturer: 'ACP', series: '456', model: 'ACP 456 IM 75HP', hp: 75, voltage: 950, amps: 49 },
    { id: 'acp-456-125-1400', manufacturer: 'ACP', series: '456', model: 'ACP 456 IM 125HP', hp: 125, voltage: 1400, amps: 55 },
    { id: 'acp-540-180-1300', manufacturer: 'ACP', series: '540', model: 'ACP 540 IM 180HP', hp: 180, voltage: 1300, amps: 85 },
    { id: 'acp-540-250-1800', manufacturer: 'ACP', series: '540', model: 'ACP 540 IM 250HP', hp: 250, voltage: 1800, amps: 85 },

    // --- WOOD GROUP / GE (Legacy) ---
    { id: 'wg-450-60-800', manufacturer: 'WoodGroup', series: '450', model: 'WG 450 60HP', hp: 60, voltage: 800, amps: 47 },
    { id: 'wg-450-90-1150', manufacturer: 'WoodGroup', series: '450', model: 'WG 450 90HP', hp: 90, voltage: 1150, amps: 48 },
];
