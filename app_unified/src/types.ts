
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
  oilDensity: 'Katz' | 'Standing' | 'Vasquez-Beggs' | 'Glaso';
  gasDensity: 'Ideal' | 'Beggs';
  waterDensity: 'Standard' | 'Beggs';
  pbRs: 'Lasater' | 'Standing' | 'Vasquez-Beggs' | 'Glaso' | 'Kartoatmodjo' | 'Petrosky' | 'Marhoun';
  oilComp: 'Vasquez-Beggs' | 'Petrosky' | 'Kartoatmodjo';
  oilFvf: 'Vasquez-Beggs' | 'Standing' | 'Glaso' | 'Marhoun' | 'Kartoatmodjo';
  waterFvf: 'HP41C' | 'Standard';
  zFactor: 'Dranchuk-Purvis' | 'Dranchuk-Abu-Kassem' | 'Hall & Yarborough';
  surfaceTensionOil: 'Baker-Swerdloff' | 'Standard';
  surfaceTensionWater: 'Hough' | 'Standard';
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

  // Specific Housing Limits from Catalog
  minStages?: number;
  maxStages?: number; // Max stages PER BODY/HOUSING
  stageIncrease?: number; // Step size (e.g., 1, 2, 3)

  minRate: number;
  bepRate: number;
  maxRate: number;
  maxFlow?: number; // Alias for maxRate
  maxEfficiency: number;
  maxHead: number;
  maxGraphRate: number;
  nameplateFrequency: number;
  od?: number; // Outer Diameter in inches
  h0: number; h1: number; h2: number; h3: number; h4: number; h5: number; h6: number;
  p0: number; p1: number; p2: number; p3: number; p4: number; p5: number; p6: number;
}

export interface EspMotor {
  id: string;
  manufacturer: string;
  series: string;
  model: string;
  hp: number;
  voltage: number;
  amps: number;
  // RPM Coefficients (R0-R5)
  r0?: number; r1?: number; r2?: number; r3?: number; r4?: number; r5?: number;
  // % NP Amps Coefficients (A0-A5)
  a0?: number; a1?: number; a2?: number; a3?: number; a4?: number; a5?: number;
  // Power Factor Coefficients (P0-P5)
  p0?: number; p1?: number; p2?: number; p3?: number; p4?: number; p5?: number;
  // Efficiency Coefficients (E0-E5)
  e0?: number; e1?: number; e2?: number; e3?: number; e4?: number; e5?: number;
}

export interface EspCable {
  id: string;
  manufacturer: string;
  type: 'Flat' | 'Round';
  awg: string; // #1, #2, #4
  model: string;
  ohmsPer1000ft: number;
  maxAmps: number;
  weightPer1000ft: number;
}

export interface EspVSD {
  id: string;
  manufacturer: string;
  brand: string;
  model: string;
  kvaRating: number;        // kVA nominal output
  inputVoltage: string;     // e.g. '460 / 600 V'
  outputVoltage: string;    // e.g. '0–600 V'
  outputFrequency: string;  // e.g. '5–120 Hz'
  thd: string;              // Total Harmonic Distortion
  efficiency: number;       // % at full load
  cooling: string;          // 'Forced Air' | 'Liquid Cooled'
  enclosure: string;        // 'NEMA 3R' | 'NEMA 4X' | 'IP54' etc.
  weight_kg: number;
  notes?: string;
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

// --- NODAL ANALYSIS TYPES ---
export interface NodalSystemPoint {
  point: number;
  rateSurface: number; // BPD
  ratePump: number; // BPD (In-situ)
  tubingHead: number; // ft (Required Discharge Head)
  pipHead: number; // ft
  tdh: number; // ft
  fluidLevel: number; // ft
}

export interface NodeProperties {
  pressure: number;
  temperature: number;
  oilRate: number;
  waterRate: number;
  gasRate: number; // BPD or MSCF/D depending on context
  freeGasPct: number;
  totalLiquidRate: number;
  sgLiquid: number;
  sgMixture: number;
  densityLiquid: number;
  densityMixture: number;
  viscosityMixture: number;
  solGor: number; // Solution GOR
  solGwr: number; // Solution GWR
  fvfLiquid: number;
  fvfMixture: number;
  zFactor: number;
  surfaceTensionOil?: number;
  surfaceTensionWater?: number;
}

export interface NodalPerformance {
  intake: NodeProperties;
  discharge: NodeProperties;
  surface: NodeProperties;
}

export interface HistoryMatchData {
  rate: number;
  frequency: number;
  waterCut: number;
  thp: number;
  tht: number;
  pip: number;
  pd: number;
  fluidLevel: number;
  submergence: number;
  pStatic: number;
  ip?: number;
  pdp?: number;
  hp?: number;
  startDate: string;
  matchDate: string;
  gor?: number;
}

export interface SystemParams {
  metadata: ProjectMetadata;
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
  selectedCable?: EspCable;
  selectedVSD?: EspVSD;      // NEW — Surface Variable Speed Drive
  simulation: SimulationSettings;
  historyMatch?: HistoryMatchData;

  // Temporary storage for matching equipment during batch import
  initialPumpName?: string;
  initialStages?: number;
  initialMotorName?: string;
  initialMotorHp?: number;
  initialCableName?: string;
  initialVSDName?: string;
}

export interface MonitoringEvent {
  id: string;
  wellName: string;
  timestamp: string;
  type: 'Info' | 'Warning' | 'Alarm' | 'Critical';
  code: string;
  message: string;
}

export interface WellHealthStatus {
  pump: 'normal' | 'caution' | 'alert' | 'failure';
  motor: 'normal' | 'caution' | 'alert' | 'failure';
  seal: 'normal' | 'caution' | 'alert' | 'failure';
  sensor: 'active' | 'inactive' | 'error';
  cable: 'normal' | 'ground-fault' | 'unbalance';
}

export interface PredictiveData {
  ttf: number; // Time to failure in days
  vsdStatus: 'optimal' | 'caution' | 'alert';
  vsdAnalysis: string;
  transformerStatus: 'optimal' | 'caution' | 'alert';
  transformerAnalysis: string;
  ventBoxStatus: 'optimal' | 'caution' | 'alert';
  ventBoxAnalysis: string;
}

export interface ProductionTest {
  date: string;
  rate: number;
  waterCut: number;
  pip: number;
  pdp: number;
  thp: number;
  tht?: number;
  gor: number;
  hp: number;
  freq: number;
  efficiency?: number;
  amps?: number;
  volts?: number;
  hasMatchData?: boolean;
}

export interface WellFleetItem {
  id: string;
  name: string;
  status: 'normal' | 'caution' | 'alert' | 'failure';
  health: WellHealthStatus;
  predictive: PredictiveData;
  lastUpdate: string;
  currentRate: number;
  targetRate: number;
  consumptionReal: number;
  consumptionTheo: number;
  productionTest: ProductionTest;
  depthMD: number;
}


