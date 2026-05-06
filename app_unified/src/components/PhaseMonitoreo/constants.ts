import { SystemParams, EspPump, WellFleetItem } from '@/types';
import { CASING_CATALOG, TUBING_CATALOG } from '@/data';

export const INITIAL_PARAMS: SystemParams = {
    metadata: {
        projectName: 'New Design 001',
        wellName: 'Well-X',
        engineer: '',
        company: '',
        date: new Date().toISOString().split('T')[0],
        comments: ''
    },
    wellbore: {
        correlation: 'Hagedorn-Brown',
        casing: CASING_CATALOG[0],
        tubing: TUBING_CATALOG[0],
        casingTop: 0, casingBottom: 0,
        tubingTop: 0, tubingBottom: 0,
        midPerfsMD: 0
    },
    fluids: {
        apiOil: 0, geGas: 0, waterCut: 0, geWater: 1.0, salinity: 0, pb: 0, gor: 0, glr: 0,
        isDeadOil: false, co2: 0, h2s: 0, n2: 0, sandCut: 0, sandDensity: 2.65,
        pvtCorrelation: 'Lasater', viscosityModel: 'Total Fluid',
        correlations: {
            viscDeadOil: 'Beggs-Robinson', viscSatOil: 'Beggs-Robinson', viscUnsatOil: 'Vasquez-Beggs',
            viscGas: 'Lee', viscWater: 'Matthews & Russell', oilDensity: 'Katz',
            gasDensity: 'Beggs', waterDensity: 'Beggs', pbRs: 'Lasater',
            oilComp: 'Vasquez-Beggs', oilFvf: 'Vasquez-Beggs', waterFvf: 'HP41C',
            zFactor: 'Dranchuk-Purvis', surfaceTensionOil: 'Baker-Swerdloff', surfaceTensionWater: 'Hough'
        }
    },
    inflow: {
        model: 'Productivity Index', staticSource: 'BHP', pStatic: 0, staticLevel: 0, ip: 0
    },
    pressures: { totalRate: 0, pht: 0, phc: 0, pumpDepthMD: 0 },
    targets: {
        min: { rate: 0, ip: 0, waterCut: 0, gor: 0, frequency: 50 },
        target: { rate: 0, ip: 0, waterCut: 0, gor: 0, frequency: 60 },
        max: { rate: 0, ip: 0, waterCut: 0, gor: 0, frequency: 60 }
    },
    activeScenario: 'target',
    surfaceTemp: 0, bottomholeTemp: 0,
    motorHp: 0,
    totalDepthMD: 0, survey: [],
    simulation: { annualWearPercent: 0, simulationMonths: 36, costPerKwh: 0, ipType: 'fixed', ipTarget: 0 }
};

export const FALLBACK_PUMP: EspPump = {
    id: 'DEMO-PUMP', manufacturer: 'REDA', series: '538', model: 'DN1200', stages: 120,
    minRate: 800, bepRate: 1200, maxRate: 1600, maxEfficiency: 72, maxHead: 50, maxGraphRate: 2000,
    nameplateFrequency: 60,
    h0: 51.5, h1: -0.002, h2: -0.000018, h3: 0, h4: 0, h5: 0, h6: 0,
    p0: 0.15, p1: 0.0001, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0,
    maxFlow: 1600
};

export const MOCK_FLEET: WellFleetItem[] = [];

// Clave nivel gratuito proporcionada por el usuario
export const GEMINI_API_KEY = "AIzaSyALOKJDFF6JHthsRq_25lcoZJXGAZYebWM";
