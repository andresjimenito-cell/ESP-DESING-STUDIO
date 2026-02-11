
export interface EspPump {
  id: string;
  manufacturer: string;
  series: string;
  model: string;
  stages: number; // Number of stages (New field)
  minRate: number; // Minimum recommended operating range
  bepRate: number; // Best Efficiency Point
  maxRate: number; // Maximum recommended operating range
  maxEfficiency: number;
  maxHead: number; // Usually at 0 flow
  maxGraphRate: number; // The X-axis limit
  nameplateFrequency: number; // e.g., 60Hz
  // Polynomial Coefficients for Head vs Flow (H0-H5)
  h0: number;
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  // Polynomial Coefficients for Power vs Flow (P0-P5)
  p0: number;
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  p5: number;
}

export interface SystemParams {
  thp: number;        // Tubing Head Pressure (psi)
  intakeMD: number;   // Measured Depth of Intake/Datum (ft)
  intakeTVD: number;  // True Vertical Depth of Intake/Datum (ft)
  pmpTVD: number;     // Punto Medio Perforados (TVD) (ft) - Was pumpTVD
  ge: number;         // Specific Gravity (Gravedad Específica)
  pStatic: number;    // Static Reservoir Pressure (psi)
  idTubing: number;   // Tubing Inner Diameter (inches)
  cte: number;        // Hazen-Williams Constant (friction factor)
  ip: number;         // Productivity Index (BFPD/psi)
  targetFlow: number; // Caudal Objetivo para el Match
  targetPip: number;  // Target PIP for sync calculator
  motorHp: number;    // Nameplate Rating of the Motor (HP)
}

export interface CurvePoint {
  flow: number;
  headBase: number;
  headActual: number;
  efficiency?: number;
  isInOperatingRangeBase?: boolean;
  isInOperatingRangeActual?: boolean;
  systemHead?: number | null; // Added for System Curve
}
