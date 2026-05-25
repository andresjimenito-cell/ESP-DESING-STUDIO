# 🤖 AGENT.md - AI Context & Guidelines

## 🚀 Overview
**ESP DESIGN STUDIO** is a high-performance engineering suite for the simulation and optimization of Electrical Submersible Pump (ESP) systems. It is built as a single-page application (SPA) where all calculations happen on the client-side for zero-latency performance.

## 🛠️ Technology Stack
- **Frontend Framework:** React 19 + Vite
- **Backend Framework:** Express (Node.js) on Port 4000
- **Language:** TypeScript (Frontend) / JavaScript (Backend)
- **Styling:** Tailwind CSS + Vanilla CSS (Custom HUD aesthetics)
- **Animations:** Anime.js + Framer Motion
- **Visuals:** Recharts (Data visualization), Mermaid (Architecture)
- **Data & Excel:** JSZip, XLSX (Excel parsing in frontend & backend)
- **Live Sync:** Server-Sent Events (SSE) via `/api/data/live-updates`

## 🎨 UI/UX Philosophy: "Zero Space Waste"
The application follows a high-density, professional "HUD" (Head-Up Display) aesthetic designed for engineering environments.
- **Maximized Real Estate:** Minimize vertical whitespace. Use sidebars and popovers for configuration instead of large headers.
- **Dark Mode HUD:** Use deep backgrounds, neon accents (cyan, green, orange), and glassmorphism.
- **Symmetry:** Maintain strict visual alignment across all modules (Phase 1 through 7).

## 📡 Live Monitoring & Data Sync Pipeline
- **OneDrive Sync:** The backend watches for file changes on local OneDrive paths (specifically the main design and SCADA Excel sheets).
- **Static Pre-Calculations:** A backend script `preprocesar_datos.js` converts large Excels into lightweight `designs_precalc.json` and `scada_precalc.json` placed in the public directory to optimize network bandwidth.
- **SSE Notification:** The frontend connects via `EventSource` to `http://localhost:4000/api/data/live-updates`. When files update on OneDrive, the server sends an `{type: "update"}` event.
- **Silent Reload:** React listens to the SSE event and silently triggers a fetch of the updated JSON data in the background, updating the UI metrics without overlays or loading spinners.

## 📂 Key Directory Structure
- `/app_unified/src/components/`: Core UI components (PhaseWellbore, PhaseFluids, PhaseMonitoreo, etc.)
- `/app_unified/src/engines/`: Mathematical engines for PVT, Nodal Analysis, and AI Matching.
- `/backend/`: Express server, watcher logic, and cache pipelines.
- `/skills/`: Technical guides and AI skills for specific engineering tasks.
- `/services/`: Helper scripts and background services (like `ESP_LAUNCHER.ps1`).
- `/public/`: Static assets, raw Excels, and precalculated data files.

## 🔄 Development Workflows
### Git Sync
When asked to "push" or "puss git", follow this sequence:
1. `git add .`
2. `git commit -m "Descriptive message"`
3. `git push`

### Component Logic
- **State Management:** Data is shared across phases through a unified state in `App.tsx` or a dedicated Context.
- **Calculations:** Ensure PVT correlations (Lasater, Vasquez-Beggs) are correctly implemented in the logic engines before rendering.

## ⚠️ Critical Constraints
- **Zero Space Waste:** Every new component MUST match the premium, dark-themed HUD style. No generic white-background UI elements.
- **Performance:** Handle large datasets (SCADA/Excel) using Workers or optimized loops to prevent UI blocking. Keep `useDeferredValue` for high-frequency search fields.
- **SSE Loop Prevention:** Ensure all data refresh handlers triggered by SSE are wrapped in stable react references (`useRef`) to prevent infinite connection loop states.
