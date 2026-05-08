# 🤖 AGENT.md - AI Context & Guidelines

## 🚀 Overview
**ESP DESIGN STUDIO** is a high-performance engineering suite for the simulation and optimization of Electrical Submersible Pump (ESP) systems. It is built as a single-page application (SPA) where all calculations happen on the client-side for zero-latency performance.

## 🛠️ Technology Stack
- **Framework:** React 19 + Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Vanilla CSS (Custom HUD aesthetics)
- **Animations:** Anime.js + Framer Motion
- **Visuals:** Recharts (Data visualization), Mermaid (Architecture)
- **Data:** JSZip, XLSX (Excel processing)

## 🎨 UI/UX Philosophy: "Zero Space Waste"
The application follows a high-density, professional "HUD" (Head-Up Display) aesthetic designed for engineering environments.
- **Maximized Real Estate:** Minimize vertical whitespace. Use sidebars and popovers for configuration instead of large headers.
- **Dark Mode HUD:** Use deep backgrounds, neon accents (blue, green, orange), and glassmorphism.
- **Symmetry:** Maintain strict visual alignment across all modules (Phase 1 through 6).

## 📂 Key Directory Structure
- `/app_unified/src/components/`: Core UI components (PhaseWellbore, PhaseFluids, PhaseMonitoreo, etc.)
- `/app_unified/src/engines/`: Mathematical engines for PVT, Nodal Analysis, and AI Matching.
- `/services/`: Helper scripts and background services.
- `/public/`: Static assets and precalculated data files.

## 🔄 Development Workflows
### Git Sync
When asked to "push" or "puss git", follow this sequence:
1. `git add .`
2. `git commit -m "Descriptive message"`
3. `git push`

### Component Logic
- **State Management:** Data is shared across phases through a unified state (likely in `App.tsx` or a dedicated Context).
- **Calculations:** Ensure PVT correlations (Lasater, Vasquez-Beggs) are correctly implemented in the logic engines before rendering.

## ⚠️ Critical Constraints
- **Client-Side Only:** Do not implement backend-dependent features unless explicitly requested.
- **Performance:** Handle large datasets (SCADA/Excel) using Workers or optimized loops to prevent UI blocking.
- **Aesthetics:** Every new component MUST match the premium, dark-themed HUD style. No generic white-background UI elements.
