# 📊 Skill: PVT Calculations Engine

## Description
This skill provides the mathematical basis for the Pressure-Volume-Temperature (PVT) correlations used in the Fluids Phase.

## Correlations
- **Lasater:** Used for Gas-Oil Ratio (GOR) and Bubble Point Pressure ($P_b$).
- **Vazquez & Beggs:** Used for Oil Formation Volume Factor ($B_o$) and Gas Solubility ($R_s$).
- **Glaso:** Alternative for saturated oil properties.

## Implementation Guidelines
- All calculations should be vectorized where possible using numeric arrays.
- Handle edge cases where Pressure ($P$) is below Bubble Point ($P_b$).
- Input units are typically PSI, Rankine, and SCF/STB.
