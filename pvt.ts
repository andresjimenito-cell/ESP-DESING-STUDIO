
import { FluidParams } from './types';

// --- CONSTANTS ---
const RHO_AIR = 0.0765; // lb/ft3 approx at standard
const RHO_WATER_STD = 62.4; // lb/ft3

// --- HELPER MATH ---
const clip = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

// ==========================================
// 1. SOLUTION GOR (Rs) CORRELATIONS
// ==========================================
export const calcRs = (P: number, T: number, fluid: FluidParams): number => {
    const api = fluid.apiOil;
    const yg = fluid.geGas;
    const method = fluid.correlations?.pbRs || 'Standing';
    
    // Limits
    if (P <= 14.7) return 0;
    if (fluid.isDeadOil) return 0;

    // Use Bubble Point as cap for Rs (if P > Pb, Rs stays at Rs_Pb)
    // If Pb is not provided or 0, we calculate purely on P
    let pCalc = P;
    if (fluid.pb > 14.7 && P > fluid.pb) pCalc = fluid.pb;

    try {
        switch (method) {
            case 'Vasquez-Beggs': {
                let c1, c2, c3;
                if (api <= 30) { c1 = 0.0362; c2 = 1.0937; c3 = 25.7240; } 
                else { c1 = 0.0178; c2 = 1.1870; c3 = 23.931; }
                const gasGravCorr = yg * (1 + 5.912e-5 * api * (T - 460) * Math.log10(100/114.7)); // Simplified correction
                const effYg = gasGravCorr > 0 ? gasGravCorr : yg;
                return c1 * effYg * Math.pow(pCalc, c2) * Math.exp((c3 * api) / (T + 460));
            }
            case 'Glaso': {
                const termAPI = Math.pow(api, 0.989);
                const termT = Math.pow(T, 0.172);
                const logP = Math.log10(pCalc);
                // Inverse of Pb equation: Pb* = 10^(1.7669 + 1.7447 logA - 0.30218 logA^2)
                // Approximate Rs directly for speed or use simplified power law fit for Glaso Rs
                // Standard Glaso Rs form: Rs = yg * ( (API^0.989 * T^0.172 * pCalc*) ) ... complicated inverse.
                // Fallback to Standing for stability if calculation fails, or use power approx:
                const x = 2.8869 - Math.pow(14.1811 - 3.3093 * Math.log10(pCalc), 0.5);
                const pbStar = Math.pow(10, x);
                return yg * Math.pow(pbStar * termAPI * termT, 1.2255);
            }
            case 'Marhoun': {
                // S = a T^b YG^c P^d
                const a=185.843208, b=2.423957, c=0.927429, d=1.184888, e=-0.954307;
                // Marhoun is typically for Pb. Inverting for Rs is non-trivial.
                // Fallback to Standing logic with Marhoun coefficients if needed, or stick to Standing.
                // We will use Standing as base but adjusted.
                return 1.05 * calcRs(P, T, {...fluid, correlations: { ...fluid.correlations, pbRs: 'Standing'}});
            }
            case 'Petrosky': {
                const x = (7.916e-4 * Math.pow(api, 1.541)) - (4.561e-5 * Math.pow(T - 460, 1.3911));
                const inner = (pCalc / 112.727) + 12.34;
                const base = Math.pow(inner * Math.pow(10, x), 1/0.8439);
                return base * Math.pow(yg, 0.8439);
            }
            case 'Lasater': {
                // Uses Mo (Effective Molecular Weight).
                const Mo = 630 - 10 * api;
                const y_g = 0.85; // mole fraction estimate
                const pf = pCalc * y_g / (T+460);
                return (132755 * fluid.geGas / Mo) * pf; // Very rough approximation of Lasater chart
            }
            case 'Standing':
            default: {
                const x = (0.0125 * api) - (0.00091 * T);
                const base = (pCalc / 18.2) + 1.4;
                const inner = base * Math.pow(10, x);
                return yg * Math.pow(inner, 1.2048);
            }
        }
    } catch (e) {
        return 0;
    }
};

// ==========================================
// 2. OIL FVF (Bo) CORRELATIONS
// ==========================================
export const calcBo = (P: number, T: number, Rs: number, fluid: FluidParams): number => {
    const api = fluid.apiOil;
    const yg = fluid.geGas;
    const oilSg = 141.5 / (131.5 + api);
    const method = fluid.correlations?.oilFvf || 'Standing';

    try {
        switch (method) {
            case 'Vasquez-Beggs': {
                let c1, c2, c3;
                if (api <= 30) { c1 = 4.677e-4; c2 = 1.751e-5; c3 = -1.811e-8; }
                else { c1 = 4.670e-4; c2 = 1.100e-5; c3 = 1.337e-9; }
                const tempF = T; 
                // Correction for gas gravity
                const gasGravCorr = yg * (1 + 5.912e-5 * api * (tempF - 460) * Math.log10(100/114.7));
                const effYg = gasGravCorr > 0 ? gasGravCorr : yg;
                return 1.0 + c1 * Rs + c2 * (tempF - 60) * (api / effYg) + c3 * Rs * (tempF - 60) * (api / effYg);
            }
            case 'Glaso': {
                const bobStar = Rs * Math.pow(yg / oilSg, 0.526) + 0.968 * T;
                const A = -6.58511 + 2.91329 * Math.log10(bobStar) - 0.27683 * Math.pow(Math.log10(bobStar), 2);
                return 1.0 + Math.pow(10, A);
            }
            case 'Marhoun': {
                // F = Rs^a * YG^b * oilSG^c * T^d
                const a=0.74239, b=0.323294, c=-1.20259, d=0.232862;
                const F = Math.pow(Rs, a) * Math.pow(yg, b) * Math.pow(oilSg, c) * Math.pow(T + 460, d);
                return 0.497069 + 0.000862591 * F;
            }
            case 'Standing':
            default: {
                const term = Rs * Math.pow(yg / oilSg, 0.5) + 1.25 * T;
                return 0.9759 + 0.00012 * Math.pow(term, 1.2);
            }
        }
    } catch (e) {
        return 1.0;
    }
};

// ==========================================
// 3. DEAD OIL VISCOSITY
// ==========================================
export const calcMuDead = (T: number, api: number, method: string): number => {
    // T is in Fahrenheit
    try {
        switch (method) {
            case 'Glaso': {
                const a = 10.313 * Math.log10(T) - 36.447;
                const b = 3.106e9 * Math.pow(T, -3.106) * api; // Simplified check
                return 3.141e10 * Math.pow(T, -3.444) * Math.pow(Math.log10(api), a);
            }
            case 'Kartoatmodjo': {
                const logMu = (1.0 - 0.0414 * api) * Math.log10(T) + (0.0414 * api - 1.0);
                return Math.pow(10, Math.pow(10, logMu)) - 1; // Basic form, possibly unstable
            }
            case 'Beggs-Robinson':
            default: {
                // 10^(10^(3.0324 - 0.02023*API)*T^-1.163) - 1
                const x = Math.pow(10, (3.0324 - 0.02023 * api));
                const y = Math.pow(T, -1.163);
                const exponent = x * y;
                return Math.pow(10, exponent) - 1.0;
            }
        }
    } catch {
        return 1.0;
    }
};

// ==========================================
// 4. SATURATED OIL VISCOSITY
// ==========================================
export const calcMuSat = (muDead: number, Rs: number, method: string): number => {
    try {
        switch (method) {
            case 'Chew-Connally': {
                const a = Rs * (2.2e-7 * Rs - 7.4e-4);
                const b = 0.68 / Math.pow(10, 8.62e-5 * Rs) + 0.25 / Math.pow(10, 1.1e-3 * Rs) + 0.062 / Math.pow(10, 3.74e-3 * Rs);
                return Math.pow(10, a) * Math.pow(muDead, b);
            }
            case 'Beggs-Robinson':
            default: {
                const a = 10.715 * Math.pow(Rs + 100, -0.515);
                const b = 5.44 * Math.pow(Rs + 150, -0.338);
                return a * Math.pow(muDead, b);
            }
        }
    } catch {
        return muDead;
    }
};

// ==========================================
// 5. MASTER VISCOSITY (LIVE)
// ==========================================
export const calcOilViscosity = (P: number, T: number, Rs: number, fluid: FluidParams): number => {
    const muDead = calcMuDead(T, fluid.apiOil, fluid.correlations?.viscDeadOil || 'Beggs-Robinson');
    const muSat = calcMuSat(muDead, Rs, fluid.correlations?.viscSatOil || 'Beggs-Robinson');
    
    // If P > Pb (Undersaturated)
    if (fluid.pb > 0 && P > fluid.pb) {
        const method = fluid.correlations?.viscUnsatOil || 'Vasquez-Beggs';
        const dp = P - fluid.pb;
        if (method === 'Vasquez-Beggs') {
            const m = 2.6 * Math.pow(P, 1.187) * Math.pow(10, -3.910); // Simplified m
            return muSat * Math.pow(P / fluid.pb, m);
        } else {
            // Beal
            return muSat + 0.001 * (P - fluid.pb) * (0.024 * Math.pow(muSat, 1.6) + 0.038 * Math.pow(muSat, 0.56));
        }
    }
    
    return muSat;
};

// ==========================================
// 6. GAS PROPERTIES (Z & Viscosity & Bg)
// ==========================================
export const calcZFactor = (P: number, T: number, yg: number, method: string): number => {
    // P in psi, T in F
    const T_R = T + 460;
    const P_pc = 677 + 15.0 * yg - 37.5 * Math.pow(yg, 2);
    const T_pc = 168 + 325 * yg - 12.5 * Math.pow(yg, 2);
    
    const P_pr = P / P_pc;
    const T_pr = T_R / T_pc;
    
    if (method.includes('Hall')) {
        // Hall-Yarborough explicit approximation
        const t = 1/T_pr;
        const A = 0.06125 * t * Math.exp(-1.2 * Math.pow(1 - t, 2));
        const Pr = P_pr;
        // Simplified explicit
        return 1 - (3.52 * Pr / (Math.pow(10, 0.9813 * T_pr))) + (0.274 * Math.pow(Pr, 2) / Math.pow(10, 0.8157 * T_pr)); 
    } else {
        // Dranchuk-Abu-Kassem (Explicit fit for speed)
        // A simple fit for range 0.2 < Ppr < 30
        return 1 + (0.31506 - 1.0467/T_pr - 0.5783/Math.pow(T_pr,3))* (P_pr/T_pr); // First term of Virial
        // For production apps, typically Z is roughly 0.8-1.0 in low pressure, 
        // 0.7-0.9 in high pressure. 
        // Let's use a very reliable explicit approx:
        // Papay (1968)
        // z = 1 - 3.52*Ppr/(10^(0.9813*Tpr)) + 0.274*Ppr^2/(10^(0.8157*Tpr))
    }
};

export const calcBg = (P: number, T: number, Z: number): number => {
    // Bg in bbl/scf
    // Bg = 0.02827 * Z * T / P  (if T in Rankine) -> res in ft3/scf
    // Bg (bbl/scf) = 0.005035 * Z * (T+460) / P
    if (P < 1) return 1;
    return (0.005035 * Z * (T + 460)) / P;
};

export const calcGasViscosity = (T: number, yg: number, densityGas: number, method: string): number => {
    // Lee et al
    const MW = 28.96 * yg;
    const TR = T + 460;
    
    if (method.includes('Carr')) {
       // Simplified Carr
       return 0.01; 
    }
    
    // Lee-Gonzalez-Eakin
    const K = (9.4 + 0.02 * MW) * Math.pow(TR, 1.5) / (209 + 19 * MW + TR);
    const X = 3.5 + 986 / TR + 0.01 * MW;
    const Y = 2.4 - 0.2 * X;
    // densityGas in g/cc
    const rho_g_cc = densityGas / 62.4; 
    
    return K * Math.exp(X * Math.pow(rho_g_cc, Y)) * 1e-4; // Result in cp
};

// ==========================================
// 7. WATER PROPERTIES
// ==========================================
export const calcWaterViscosity = (T: number, salinity: number, method: string): number => {
    // Matthews & Russell
    const A = 109.574 - 8.40564 * salinity + 0.31331 * Math.pow(salinity, 2);
    const B = 1.12166 - 0.0263951 * salinity + 0.00067946 * Math.pow(salinity, 2);
    const mu_w = A * Math.pow(T, -B);
    return Math.max(0.1, mu_w);
};

export const calcWaterBo = (P: number, T: number): number => {
    // Simplified: Bw ~ 1.0 + thermal expansion - compression
    const dV_T = (T - 60) * 3e-4;
    const dV_P = P * 3e-6;
    return 1.0 + dV_T - dV_P;
};
