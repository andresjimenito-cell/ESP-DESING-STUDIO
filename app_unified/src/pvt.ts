import { FluidParams } from './types';

// ==========================================
// 1. SOLUTION GAS-OIL RATIO (Rs) & BUBBLE POINT (Pb)
// ==========================================
export const calcRs = (P: number, T: number, fluid: FluidParams): number => {
    const yg = Math.max(0.1, Math.min(2.0, fluid.geGas || 0.7));
    const api = Math.max(1, Math.min(100, fluid.apiOil || 35));
    const method = fluid.correlations?.pbRs || 'Lasater';

    if (P <= 14.7 || fluid.isDeadOil) return 0;
    let pCalc = Math.max(0, P);
    if (fluid.pb > 14.7 && P > fluid.pb) pCalc = fluid.pb;

    try {
        switch (method) {
            case 'Lasater': {
                // Lasater (1958) - SubPump default
                const Mo = api <= 40
                    ? 630 - 10 * api
                    : 73110 * Math.pow(api, -1.562);
                const y_g = (yg * pCalc) / (yg * pCalc + (352.4 * (T + 460) / Mo));
                let x = 0;
                if (y_g < 0.6) x = 0.679 * Math.exp(2.786 * y_g) - 0.323;
                else x = 8.26 * Math.pow(y_g, 3.56) + 1.95;
                const rs = (x * Mo * yg) / (y_g * 133); // Simplified approx
                return isNaN(rs) ? 0 : Math.max(0, rs);
            }
            case 'Vasquez-Beggs': {
                let c1 = api <= 30 ? 0.0362 : 0.0178;
                let c2 = api <= 30 ? 1.0937 : 1.1870;
                let c3 = api <= 30 ? 25.7240 : 23.931;
                // Correct yg for separator conditions
                const ys = yg * (1 + 5.912e-5 * api * (T - 60) * Math.log10(114.7 / 14.7)); // Approx
                return c1 * ys * Math.pow(pCalc, c2) * Math.exp((c3 * api) / (T + 460));
            }
            case 'Standing':
            default: {
                const x = (0.0125 * api) - (0.00091 * T);
                const base = (pCalc / 18.2) + 1.4;
                return yg * Math.pow(Math.max(0.1, base * Math.pow(10, x)), 1.2048);
            }
        }
    } catch { return 0; }
};

export const calcPb = (Rs: number, T: number, fluid: FluidParams): number => {
    const yg = Math.max(0.1, fluid.geGas || 0.7);
    const api = Math.max(1, fluid.apiOil || 35);
    const method = fluid.correlations?.pbRs || 'Lasater';

    try {
        switch (method) {
            case 'Lasater': {
                const Mo = api <= 40 ? 630 - 10 * api : 73110 * Math.pow(api, -1.562);
                const y_g = (Rs / yg) / (Rs / yg + 350); // Mole fraction guess
                let pf = 0;
                if (y_g < 0.6) pf = 0.679 * Math.exp(2.786 * y_g);
                else pf = 8.26 * Math.pow(y_g, 3.56) + 1.95;
                return (pf * (T + 460)) / yg;
            }
            case 'Vasquez-Beggs': {
                let c1 = api <= 30 ? 0.0362 : 0.0178;
                let c2 = api <= 30 ? 1.0937 : 1.1870;
                let c3 = api <= 30 ? 25.7240 : 23.931;
                return Math.pow(Rs / (c1 * yg * Math.exp((c3 * api) / (T + 460))), 1 / c2);
            }
            default:
                return 1000; // Placeholder
        }
    } catch { return 1000; }
};

// ==========================================
// 2. OIL PROPERTIES (Bo, Co, Density)
// ==========================================
export const calcBo = (P: number, T: number, Rs: number, fluid: FluidParams): number => {
    const yg = Math.max(0.1, fluid.geGas || 0.7);
    const api = Math.max(1, fluid.apiOil || 35);
    const method = fluid.correlations?.oilFvf || 'Vasquez-Beggs';

    try {
        if (method === 'Vasquez-Beggs') {
            const c1 = api <= 30 ? 4.677e-4 : 4.670e-4;
            const c2 = api <= 30 ? 1.751e-5 : 1.100e-5;
            const c3 = api <= 30 ? -1.811e-8 : 1.337e-9;
            const bo = 1.0 + c1 * Rs + c2 * (T - 60) * (api / yg) + c3 * Rs * (T - 60) * (api / yg);
            // Compression above Pb
            if (P > fluid.pb && fluid.pb > 0) {
                const co = calcCo(P, T, Rs, fluid);
                return bo * Math.exp(-co * (P - fluid.pb));
            }
            return bo;
        }
        // Standing (Fallback)
        const sgO = 141.5 / (131.5 + api);
        const F = Rs * Math.pow(yg / sgO, 0.5) + 1.25 * T;
        return 0.9759 + 0.00012 * Math.pow(F, 1.2);
    } catch { return 1.0; }
};

export const calcCo = (P: number, T: number, Rs: number, fluid: FluidParams): number => {
    const api = fluid.apiOil;
    const yg = fluid.geGas;
    // Vasquez & Beggs (1980)
    const co = (-1433 + 5 * Rs + 17.2 * T - 1180 * yg + 12.61 * api) / (100000 * P);
    return Math.max(1e-6, co);
};

export const calcOilDensity = (P: number, T: number, Rs: number, Bo: number, fluid: FluidParams): number => {
    const api = fluid.apiOil;
    const yg = fluid.geGas;
    const sgO = 141.5 / (131.5 + api);
    // Katz (1942) - Integrated approach
    const rho_oil_std = 62.4 * sgO;
    const rho_mix = (rho_oil_std + 0.0136 * Rs * yg) / Bo;
    return Math.max(30, rho_mix); // lb/ft3
};

// ==========================================
// 3. VISCOSITY (Dead, Sat, Unsat)
// ==========================================
export const calcMuDead = (T: number, api: number): number => {
    // Beggs & Robinson (1975)
    const x = Math.pow(10, 3.0324 - 0.02023 * api) * Math.pow(T, -1.163);
    return Math.pow(10, x) - 1;
};

export const calcMuSat = (muDead: number, Rs: number): number => {
    // Beggs & Robinson (1975)
    const a = 10.715 * Math.pow(Rs + 100, -0.515);
    const b = 5.44 * Math.pow(Rs + 150, -0.338);
    return a * Math.pow(muDead, b);
};

export const calcMuUnsat = (muSat: number, P: number, Pb: number): number => {
    // Vasquez & Beggs (1980)
    const m = 2.6 * Math.pow(P, 1.187) * Math.pow(10, -3.910);
    return muSat * Math.pow(P / Math.max(1, Pb), m);
};

export const calcOilViscosity = (P: number, T: number, Rs: number, fluid: FluidParams): number => {
    const muD = calcMuDead(T, fluid.apiOil);
    const muS = calcMuSat(muD, Rs);
    if (P > fluid.pb && fluid.pb > 0) return calcMuUnsat(muS, P, fluid.pb);
    return muS;
};

// ==========================================
// 4. GAS PROPERTIES (Z, Visc, Bg, Density)
// ==========================================
export const calcZFactor = (P: number, T: number, yg: number): number => {
    const TR = T + 460;
    const Ppc = 677 + 15.0 * yg - 37.5 * yg * yg;
    const Tpc = 168 + 325 * yg - 12.5 * yg * yg;
    const Ppr = P / Ppc;
    const Tpr = TR / Tpc;
    // Dranchuk & Purvis (1975) approximation for Z
    const T_pr = Tpr;
    const P_pr = Ppr;
    return 1.0 - (3.52 * P_pr / Math.pow(10, 0.9813 * T_pr)) + (0.274 * P_pr * P_pr / Math.pow(10, 0.8157 * T_pr));
};

export const calcGasViscosity = (T: number, yg: number, density: number): number => {
    // Lee, Gonzalez, Eakin (1966)
    const MW = 28.96 * yg;
    const TR = T + 460;
    const rho = density / 62.4; // g/cc
    const K = (9.4 + 0.02 * MW) * Math.pow(TR, 1.5) / (209 + 19 * MW + TR);
    const X = 3.5 + 986 / TR + 0.01 * MW;
    const Y = 2.4 - 0.2 * X;
    return K * Math.exp(X * Math.pow(rho, Y)) * 1e-4;
};

export const calcGasDensity = (P: number, T: number, Z: number, yg: number): number => {
    // Beggs ideal gas derived
    return (2.7 * yg * P) / (Z * (T + 460)); // lb/ft3
};

export const calcBg = (P: number, T: number, Z: number): number => {
    if (P < 1) return 1;
    return (0.005035 * Z * (T + 460)) / P;
};

// ==========================================
// 5. WATER PROPERTIES (Bw, Cw, Visc, Density)
// ==========================================
export const calcWaterBo = (P: number, T: number): number => {
    // HP41C (SubPump style / McCain approximation)
    const dVT = -1.0001e-2 + 1.33391e-4 * T + 5.50654e-7 * T * T;
    const dVP = -1.95301e-9 * P * T - 1.72834e-13 * P * P * T - 3.58922e-7 * P - 2.25341e-10 * P * P;
    return (1 + dVT) * (1 + dVP);
};

export const calcWaterCw = (P: number, T: number, S: number): number => {
    // Meehan (1980)
    const tSafe = T;
    const sSafe = S / 10000; // ppm to % weight
    const cw = (1e-6) * (3.8546 - 0.000134 * tSafe + sSafe * (0.00016));
    return Math.max(1e-7, cw);
};

export const calcWaterViscosity = (T: number, salinity_ppm: number): number => {
    // Matthews & Russell
    const sal = salinity_ppm / 10000;
    const A = 109.574 - 8.40564 * sal + 0.313314 * sal * sal;
    const B = 1.12166 - 2.63951e-2 * sal + 6.79461e-4 * sal * sal;
    return A * Math.pow(T, -B);
};

export const calcWaterDensity = (geWater: number, Bw: number): number => {
    // lb/ft3
    return (62.4 * geWater) / Bw;
};

// ==========================================
// 6. SURFACE TENSION (Baker-Swerdloff & Hough)
// ==========================================
export const calcOilSurfaceTension = (T: number, api: number): number => {
    // Baker & Swerdloff
    const sig68 = 39 - 0.25 * api;
    const sig100 = 37.5 - 0.25 * api;
    if (T <= 68) return sig68;
    return sig68 - (T - 68) * (sig68 - sig100) / 32;
};

export const calcWaterSurfaceTension = (T: number): number => {
    // Hough et al (1951)
    return 75.27 - 0.06 * T - 0.0003 * T * T;
};
