
export interface ProjectMetadata {
  projectName: string;
  wellName: string;
  engineer: string;
  company: string;
  date: string;
  comments: string;
}

export interface PipeData {
  description: string;
  od: number;
  id: number;
  weight: number;
  roughness: number;
}

export interface WellboreParams {
  correlation: 'Hagedorn-Brown' | 'Beggs-Brill' | 'Duns-Ros';
  casing: PipeData;
  tubing: PipeData;
  casingTop: number;
  casingBottom: number;
  tubingTop: number;
  tubingBottom: number;
  midPerfsMD: number;
}

export interface FluidCorrelations {
  viscDeadOil: 'Beggs-Robinson' | 'Glaso' | 'Kartoatmodjo' | 'Beal';
  viscSatOil: 'Beggs-Robinson' | 'Chew-Connally' | 'Kartoatmodjo';
  viscUnsatOil: 'Vasquez-Beggs' | 'Kartoatmodjo' | 'Beal';
  viscGas: 'Lee' | 'Carr-Kobayashi-Burrows';
  viscWater: 'Matthews & Russell' | 'Meehan';
  oilDensity: 'Standing' | 'Vasquez-Beggs' | 'Glaso' | 'Marhoun' | 'Katz';
  pbRs: 'Standing' | 'Vasquez-Beggs' | 'Glaso' | 'Lasater' | 'Kartoatmodjo' | 'Petrosky' | 'Marhoun';
  oilComp: 'Vasquez-Beggs' | 'Petrosky' | 'Kartoatmodjo';
  oilFvf: 'Standing' | 'Vasquez-Beggs' | 'Glaso' | 'Marhoun' | 'Kartoatmodjo';
  zFactor: 'Hall & Yarborough' | 'Dranchuk-Abu-Kassem' | 'Dranchuk-Purvis';
}

export interface FluidParams {
  apiOil: number;
  geGas: number;
  waterCut: number;
  geWater: number;
  salinity: number;
  pb: number; 
  gor: number;
  glr: number;
  isDeadOil: boolean;
  co2: number;
  h2s: number;
  n2: number;
  sandCut: number; // % Volume of solids
  sandDensity: number; // Specific Gravity of solids (default 2.65)
  pvtCorrelation: 'Standing' | 'Vasquez-Beggs' | 'Lasater'; // Legacy
  viscosityModel: 'Oil Only' | 'Water Only' | 'Total Fluid' | 'Emulsion'; // Legacy
  correlations: FluidCorrelations;
}

export interface InflowParams {
  model: 'Productivity Index' | 'Vogel' | 'Vogel (Water Correction)';
  staticSource: 'BHP' | 'Fluid Level';
  pStatic: number;
  staticLevel: number;
  ip: number;
}

export interface PressureParams {
  totalRate: number;
  pht: number; 
  phc: number; 
  pumpDepthMD: number;
}

export interface ScenarioData {
    rate: number;
    ip: number;
    waterCut: number;
    gor: number;
    frequency: number; 
}

export interface ProductionTargets {
    min: ScenarioData;
    target: ScenarioData;
    max: ScenarioData;
}

export interface EspPump {
  id: string;
  manufacturer: string;
  series: string;
  model: string;
  stages: number;
  housingCount?: number; // Calculated automatically
  maxStagesPerBody?: number; // User input limit
  minRate: number;
  bepRate: number;
  maxRate: number;
  maxEfficiency: number;
  maxHead: number;
  maxGraphRate: number;
  nameplateFrequency: number;
  h0: number; h1: number; h2: number; h3: number; h4: number; h5: number;
  p0: number; p1: number; p2: number; p3: number; p4: number; p5: number;
}

export interface EspMotor {
    id: string;
    manufacturer: string;
    series: string;
    model: string;
    hp: number;
    voltage: number;
    amps: number;
}

export interface SurveyPoint {
  md: number;
  tvd: number;
}

export interface SimulationSettings {
    annualWearPercent: number;
    simulationMonths: number;
    costPerKwh: number;
}

export interface SystemParams {
  metadata: ProjectMetadata; // Added Metadata
  wellbore: WellboreParams;
  fluids: FluidParams;
  inflow: InflowParams;
  pressures: PressureParams;
  targets: ProductionTargets; 
  activeScenario: 'min' | 'target' | 'max'; 
  surfaceTemp: number;
  bottomholeTemp: number;
  totalDepthMD: number;
  survey: SurveyPoint[];
  motorHp: number; 
  selectedMotor?: EspMotor; 
  simulation: SimulationSettings; 
}
