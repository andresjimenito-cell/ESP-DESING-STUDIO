
import { EspPump, CurvePoint, SystemParams } from './types';

/**
 * Calculates the Total Dynamic Head (TDH) for a given flow rate using the pump's polynomial coefficients.
 * This is for the BASE frequency (Nameplate).
 * FORMULA: Stages * (H0 + H1*Q + H2*Q^2 ...)
 */
export const calculateBaseHead = (flow: number, pump: EspPump): number => {
  const { h0, h1, h2, h3, h4, h5, stages } = pump;
  // Polynomial: H_stage = h0 + h1*Q + h2*Q^2 + h3*Q^3 + h4*Q^4 + h5*Q^5
  const headPerStage =
    h0 +
    h1 * flow +
    h2 * Math.pow(flow, 2) +
    h3 * Math.pow(flow, 3) +
    h4 * Math.pow(flow, 4) +
    h5 * Math.pow(flow, 5);
  
  // Total Head = HeadPerStage * Stages
  const totalHead = headPerStage * (stages || 1);

  return totalHead; 
};

/**
 * Calculates Power Per Stage (HP) using P coefficients at BASE frequency.
 */
export const calculateBasePowerPerStage = (flow: number, pump: EspPump): number => {
    const { p0, p1, p2, p3, p4, p5 } = pump;
    // Polynomial: P_stage = p0 + p1*Q + p2*Q^2 ...
    const powerPerStage = 
        p0 + 
        p1 * flow +
        p2 * Math.pow(flow, 2) +
        p3 * Math.pow(flow, 3) +
        p4 * Math.pow(flow, 4) +
        p5 * Math.pow(flow, 5);
    
    return Math.max(0, powerPerStage);
}

/**
 * Calculates head at a specific flow for a specific frequency using affinity laws.
 */
const calculateAffinityHead = (targetFlow: number, targetFreq: number, baseFreq: number, pump: EspPump): number | null => {
    if (baseFreq === 0) return 0; // Avoid div by zero
    const ratio = targetFreq / baseFreq;
    if (ratio === 0) return 0;
    
    // Affinity Law: Q_base = Q_target / ratio
    const baseFlow = targetFlow / ratio;
    
    // Check if baseFlow is within reasonable graph limits (safety cap)
    // If pump.maxGraphRate is 0, we can't really limit, so just proceed or check against 0
    if (pump.maxGraphRate > 0 && baseFlow > pump.maxGraphRate * 1.5) return null;

    const baseHead = calculateBaseHead(baseFlow, pump);
    
    // Affinity Law: H_target = H_base * ratio^2
    const targetHead = baseHead * Math.pow(ratio, 2);
    
    return targetHead;
}

/**
 * Calculates BHP (Power) at a specific flow and frequency using Affinity Laws.
 * Formula: P2 = P1 * (N2/N1)^3 * SG
 */
const calculateBhpAtPoint = (flowActual: number, freqActual: number, baseFreq: number, pump: EspPump, sg: number): number => {
    const ratio = freqActual / baseFreq;
    const flowBase = flowActual / ratio;
    
    let bhpTotal = 0;
    
    // Check if P coefficients exist
    const hasPowerCoeffs = (Math.abs(pump.p0) + Math.abs(pump.p1) + Math.abs(pump.p2) + Math.abs(pump.p3)) > 0.0000001;
    
    if (hasPowerCoeffs) {
        // Use Polynomials
        const powerBasePerStage = calculateBasePowerPerStage(flowBase, pump);
        const powerActualPerStage = powerBasePerStage * Math.pow(ratio, 3) * sg;
        bhpTotal = powerActualPerStage * (pump.stages || 1);
    } else {
        // Fallback: Use Efficiency estimation
        // 1. Calculate Hydraulic Power at this point
        //    Need Head first
        const headBase = calculateBaseHead(flowBase, pump);
        const headActual = headBase * Math.pow(ratio, 2);
        
        const hydraulicHp = (flowActual * headActual * sg) / 135770;
        
        // 2. Estimate Efficiency
        const bepActual = pump.bepRate * ratio;
        let effFactor = 0.1;
        if (bepActual > 0) {
            const deviation = (flowActual - bepActual) / (bepActual * 1.5);
            effFactor = 1 - Math.pow(deviation, 2); 
        }
        if (effFactor < 0.1) effFactor = 0.1;
        if (effFactor > 1.0) effFactor = 1.0;
        
        const estEfficiencyDec = (pump.maxEfficiency / 100) * effFactor;
        const finalEff = estEfficiencyDec > 0 ? estEfficiencyDec : 0.01;
        
        bhpTotal = hydraulicHp / finalEff;
    }
    
    return bhpTotal;
}

/**
 * Calculates the System TDH required at a specific flow rate based on user provided formulas.
 */
const calculateSystemTDH = (flow: number, sys: SystemParams): number => {
    const q = flow;
    const ip = sys.ip > 0 ? sys.ip : 0.001; 
    const pStatic = sys.pStatic;
    const cte = sys.cte > 0 ? sys.cte : 120;
    const id = sys.idTubing > 0 ? sys.idTubing : 2.441;
    const intakeMD = sys.intakeMD;
    const intakeTVD = sys.intakeTVD;
    const pmpTVD = sys.pmpTVD;
    const ge = sys.ge;
    const thp = sys.thp;
    
    // 1. Pwf Logic: si(p estatica-(q/ip)<0;#n/d;...)
    const pwf = pStatic - (q / ip);
    
    // If Pwf is negative, the well cannot sustain this rate (vacuum/pumped off)
    if (pwf < 0) return NaN;

    // 2. Friction Term: 
    // (2,083*((100/cte)^1,85)*(((0,02917*q)^1,85)/id tbg ^4,8655))*(intake md/1000)
    const termC = Math.pow(100 / cte, 1.85);
    const termQ = Math.pow(0.02917 * q, 1.85);
    const termID = Math.pow(id, 4.8655);
    const friction = (2.083 * termC * (termQ / termID)) * (intakeMD / 1000);

    // 3. THP Head Term:
    const thpHead = thp / (0.433 * ge);

    // 4. Lift (Hd) Term:
    // Hydrostatic difference between PMP and Intake
    const hydrostaticColumn = (pmpTVD - intakeTVD) * 0.433 * ge;
    
    // Pressure at Intake (PIP) = Pwf (at PMP) - Hydrostatic Diff
    const pip = pwf - hydrostaticColumn;
    
    // Head at Intake
    const pipHead = pip / (0.433 * ge);
    
    // Lift Required = Intake TVD - Head_at_Intake (Equivalent Liquid Level)
    const lift = intakeTVD - pipHead;

    // Final TDH
    return friction + thpHead + lift;
};

/**
 * Calculates specific system results (PIP, Pwf, Qmax) AND HP Estimates.
 * Uses the intersection flow (Match) to calculate dynamic pressures.
 */
export const calculateSystemResults = (
    matchFlow: number | null, 
    matchHead: number | null,
    sys: SystemParams, 
    pump: EspPump, 
    frequency: number
) => {
    // Q max (AOF) - Absolute Open Flow (when Pwf = 0)
    const qMax = sys.pStatic * sys.ip;

    if (matchFlow === null || matchHead === null) {
        return {
            pip: null,
            pwf: null,
            qMax,
            hpTotal: null,
            hpPerStage: null,
            headPerStage: null,
            effEstimated: null,
            motorLoad: null,
            requiredMotorHp: null
        };
    }

    const q = matchFlow;
    const stages = pump.stages > 0 ? pump.stages : 1;
    const baseFreq = pump.nameplateFrequency > 0 ? pump.nameplateFrequency : 60;
    
    // Calculate Head Per Stage
    const headPerStage = matchHead / stages;

    // Pwf & PIP
    const pwf = sys.pStatic - (q / sys.ip);
    const hydrostaticColumn = (sys.pmpTVD - sys.intakeTVD) * 0.433 * sys.ge;
    const pip = pwf - hydrostaticColumn;

    // --- HP & EFFICIENCY CALCULATION ---
    // 1. Calculate Brake HP (Total) using the dedicated function
    const hpTotal = calculateBhpAtPoint(q, frequency, baseFreq, pump, sys.ge);

    // 2. Calculate Hydraulic HP: (Q * H * SG) / 135770
    const hydraulicHp = (q * matchHead * sys.ge) / 135770;

    // 3. Efficiency = HHP / BHP
    let finalEff = 0;
    if (hpTotal > 0) {
        finalEff = (hydraulicHp / hpTotal) * 100;
    }
    // Clamp visual efficiency
    if (finalEff > 100) finalEff = 100;

    // 4. HP Per Stage
    const hpPerStage = hpTotal / stages;

    // 5. Motor Load Calculation
    // Load = Required BHP / Nameplate HP
    const motorLoad = sys.motorHp > 0 ? (hpTotal / sys.motorHp) * 100 : null;
    
    // 6. Required Motor Rating (with Safety Factor 1.1)
    // Formula from image: N_motor = (n * N_stg * SG * k^3) * 1.1
    // This is equivalent to BHP * 1.1
    const requiredMotorHp = hpTotal * 1.1;

    return {
        pip,
        pwf,
        qMax,
        hpTotal,        // BHP (Operating Point)
        hpPerStage,
        headPerStage,
        effEstimated: finalEff,
        motorLoad,
        requiredMotorHp
    };
};

/**
 * Generates the dataset.
 */
export const generateMultiCurveData = (
  pump: EspPump,
  system: SystemParams,
  userFrequency: number,
  points: number = 100
): any[] => {
  const data: any[] = [];
  const baseFreq = pump.nameplateFrequency > 0 ? pump.nameplateFrequency : 60;
  
  // Standard curves to show
  const standardFreqs = [30, 40, 50, 60, 70];
  
  // Calculate max flow for the X-axis
  const maxFreq = Math.max(70, userFrequency);
  const maxPlotFlow = pump.maxGraphRate > 0 
      ? (pump.maxGraphRate * (maxFreq / baseFreq)) * 1.1 
      : 1000;
  
  const step = maxPlotFlow / points;

  const activeCurves: Record<string, boolean> = {
      userHz: true
  };
  standardFreqs.forEach(f => activeCurves[`hz${f}`] = true);

  // Cone limits
  const headAtMinBase = Math.max(0, calculateBaseHead(pump.minRate, pump));
  const headAtMaxBase = Math.max(0, calculateBaseHead(pump.maxRate, pump));
  
  let kMin = 0, kMax = 0;
  if (pump.minRate > 0) kMin = headAtMinBase / Math.pow(pump.minRate, 2);
  if (pump.maxRate > 0) kMax = headAtMaxBase / Math.pow(pump.maxRate, 2);
  
  const MAX_CONE_HZ = 80;
  const maxConeFlowMin = pump.minRate * (MAX_CONE_HZ / baseFreq);
  const maxConeFlowMax = pump.maxRate * (MAX_CONE_HZ / baseFreq);


  for (let i = 0; i <= points; i++) {
      const flow = i * step; 
      const point: any = { flow: Number(flow.toFixed(0)) };
      
      // 1. Standard Curves (30-70Hz)
      standardFreqs.forEach(freq => {
          const key = `hz${freq}`;
          if (activeCurves[key]) {
              const h = calculateAffinityHead(flow, freq, baseFreq, pump);
              if (h !== null && h > 1) { 
                  point[key] = Number(h.toFixed(2));
              } else {
                  activeCurves[key] = false; 
                  point[key] = null;
              }
          } else {
              point[key] = null;
          }
      });

      // 2. User Frequency Curve (Head) AND Efficiency
      if (activeCurves.userHz) {
          const hUser = calculateAffinityHead(flow, userFrequency, baseFreq, pump);
          if (hUser !== null && hUser > 1) {
              point.userHz = Number(hUser.toFixed(2));
              
              // --- CALCULATE EFFICIENCY FOR CURVE ---
              // Only calculate if flow > 0 to avoid div/0
              if (flow > 0) {
                  const bhp = calculateBhpAtPoint(flow, userFrequency, baseFreq, pump, system.ge);
                  const hhp = (flow * hUser * system.ge) / 135770;
                  let eff = 0;
                  if (bhp > 0) eff = (hhp / bhp) * 100;
                  // Filter weird spikes at very low flow
                  if (eff > 0 && eff < 100) point.efficiency = Number(eff.toFixed(1));
                  else point.efficiency = null;
              } else {
                  point.efficiency = 0;
              }

          } else {
              activeCurves.userHz = false;
              point.userHz = null;
              point.efficiency = null;
          }
      }

      // 3. System Curve
      if (system.ip > 0 && system.pStatic > 0) {
          const sysHead = calculateSystemTDH(flow, system);
          if (!isNaN(sysHead) && sysHead > 0) { 
              point.systemCurve = Number(sysHead.toFixed(2));
          } else {
              point.systemCurve = null;
          }
      }

      // 4. Efficiency Cone
      if (kMin > 0 && flow <= maxConeFlowMin) {
          const minH = kMin * Math.pow(flow, 2);
          point.minLimit = minH > 0 ? Number(minH.toFixed(2)) : null;
      } else {
          point.minLimit = null;
      }

      if (kMax > 0 && flow <= maxConeFlowMax) {
          const maxH = kMax * Math.pow(flow, 2);
          point.maxLimit = maxH > 0 ? Number(maxH.toFixed(2)) : null;
      } else {
          point.maxLimit = null;
      }

      data.push(point);
  }

  return data;
};

/**
 * Calculates the exact intersection point (Match).
 */
export const findIntersection = (data: any[]): { flow: number, head: number } | null => {
    for (let i = 0; i < data.length - 1; i++) {
        const p1 = data[i];
        const p2 = data[i+1];

        if (p1.userHz !== null && p1.systemCurve !== null && 
            p2.userHz !== null && p2.systemCurve !== null) {
            
            const diff1 = p1.userHz - p1.systemCurve;
            const diff2 = p2.userHz - p2.systemCurve;

            if ((diff1 > 0 && diff2 < 0) || (diff1 < 0 && diff2 > 0)) {
                const totalDiff = Math.abs(diff1) + Math.abs(diff2);
                const fraction = Math.abs(diff1) / totalDiff;
                
                const flowStep = p2.flow - p1.flow;
                const intersectFlow = p1.flow + (flowStep * fraction);
                
                const headStep = p2.userHz - p1.userHz;
                const intersectHead = p1.userHz + (headStep * fraction);

                return {
                    flow: Math.round(intersectFlow),
                    head: Math.round(intersectHead)
                };
            }
        }
    }
    return null;
}

export const calculateOperatingRange = (pump: EspPump, targetFrequency: number) => {
    const baseFreq = pump.nameplateFrequency > 0 ? pump.nameplateFrequency : 60;
    const ratio = targetFrequency / baseFreq;
    return {
        minRate: pump.minRate * ratio,
        maxRate: pump.maxRate * ratio,
        bepRate: pump.bepRate * ratio
    };
};
