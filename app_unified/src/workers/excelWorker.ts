// ─────────────────────────────────────────────────────────────────────────────
// Excel Web Worker — Ejecuta todo el análisis de archivos XLSX en un hilo separado.
// El hilo principal de la interfaz de usuario NUNCA se bloquea.
// ─────────────────────────────────────────────────────────────────────────────
import { read, utils as xlsxUtils } from 'xlsx';

type SurveyPoint = {
    md: number;
    tvd: number;
    inc?: number;
    azim?: number;
    subSea?: number;
    northing?: number;
    ns?: 'N' | 'S';
    easting?: number;
    ew?: 'E' | 'W';
    northingM?: number;
    eastingM?: number;
    verticalSection?: number;
    dogleg?: number;
};

// ── Funciones auxiliares (duplicadas aquí para que el worker sea autónomo) ──
const _s  = (v: any): string => (v == null ? '' : String(v).trim());
const _n  = (v: any): number => { const p = parseFloat(String(v)); return isNaN(p) ? 0 : Math.round(p * 100) / 100; };
const _norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

const _get = (row: Record<string, any>, keys: string[]): any => {
    const nk = keys.map(_norm);
    // Paso 1: Búsqueda exacta
    for (const h of Object.keys(row)) {
        const n = _norm(h);
        if (nk.some(k => n === k)) return row[h];
    }
    // Paso 2: Búsqueda por subcadena parcial
    for (const h of Object.keys(row)) {
        const n = _norm(h);
        if (nk.some(k => k.length >= 6 && n.includes(k))) return row[h];
    }
    return null;
};

const progress = (val: number) => self.postMessage({ type: 'progress', value: val });

self.onmessage = async (e: MessageEvent) => {
    const { buffer } = e.data as { buffer: ArrayBuffer };

    try {
        progress(10);

        // ── 1. Procesar el archivo de Excel ──────────────────────────────────
        // Operación síncrona pesada — ahora segura en el hilo del worker
        const wb = read(new Uint8Array(buffer), { type: 'array' });
        progress(30);

        // ── 2. Hoja de Trayectoria (Survey) ──────────────────────────────────
        const surveyMap: Record<string, SurveyPoint[]> = {};
        const svSheet = wb.SheetNames.find(n =>
            n.toUpperCase().includes('SURVEY') || n.toUpperCase().includes('TRAYEC')
        );
        if (svSheet) {
            const aoa: any[][] = xlsxUtils.sheet_to_json(wb.Sheets[svSheet], { header: 1, defval: '' });
            let hi = 0;
            for (let i = 0; i < Math.min(aoa.length, 15); i++) {
                const r = (aoa[i] || []).map((c: any) => _norm(String(c))).join('|');
                if (r.includes('POZO') || r.includes('WELL') || r.includes('MD') || r.includes('MEASURED')) { hi = i; break; }
            }
            const hdrs = (aoa[hi] || []).map((c: any) => _s(c));
            const normHdrs = hdrs.map(_norm);

            // Buscar índices una sola vez para máxima velocidad en el worker
            const resolveIndex = (keys: string[]): number => {
                const nk = keys.map(_norm);
                for (let j = 0; j < normHdrs.length; j++) {
                    const n = normHdrs[j];
                    if (nk.some(k => n === k || (k.length >= 3 && n.includes(k)) || (n.length >= 3 && k.includes(n)))) return j;
                }
                return -1;
            };

            const wIdx = resolveIndex(['POZO', 'WELL', 'NOMBRE']);
            const mdIdx = resolveIndex(['MEASURED DEPTH', 'MD', 'MEASUREDDEPTH']);
            const tvdIdx = resolveIndex(['VERTICAL DEPTH', 'TVD', 'VERTICALDEPTH']);
            const incIdx = resolveIndex(['INC DEG', 'INC. DEG', 'INC. (DEG)', 'INC (DEG)', 'INCLINATION', 'INC', 'INCL']);
            const azimIdx = resolveIndex(['AZIM DEG', 'AZIM. DEG', 'AZIM. (DEG)', 'AZIM (DEG)', 'AZIMUTH', 'AZIM', 'AZIMUT']);
            const subSeaIdx = resolveIndex(['SUB SEA DEPTH', 'SUBSEA', 'SUB SEA', 'SUB-SEA', 'SUBSEA DEPTH']);
            const northingIdx = resolveIndex(['NORTHING FT', 'NORTHINGS FT', 'NORTHING (FT)', 'NORTHINGS (FT)', 'NORTHINGS FT LATITUDE', 'NORTHINGS LATITUDE', 'NORTHINGS', 'NORTHING', 'LATITUDE', 'NOTHING', 'NOTHINGS', 'NOTHING FT', 'NOTHINGS FT', 'NOTHING (FT)', 'NOTHINGS (FT)']);
            const nsIdx = resolveIndex(['NS', 'N S', 'N/S', 'DIR NS', 'DIR N/S']);
            const eastingIdx = resolveIndex(['EASTING FT', 'EASTINGS FT', 'EASTING (FT)', 'EASTINGS (FT)', 'EASTINGS FT LONGITUDE', 'EASTINGS LONGITUDE', 'EASTINGS', 'EASTING', 'LONGITUDE']);
            const ewIdx = resolveIndex(['EW', 'E W', 'E/W', 'DIR EW', 'DIR E/W']);
            const northingMIdx = resolveIndex(['NORTHING M', 'NORTHINGS M', 'NORTHING (M)', 'NORTHINGS (M)', 'NOTHING M', 'NOTHINGS M', 'NOTHING (M)', 'NOTHINGS (M)']);
            const eastingMIdx = resolveIndex(['EASTING M', 'EASTINGS M', 'EASTING (M)', 'EASTINGS (M)']);
            const verticalSectionIdx = resolveIndex(['VERTICAL SECTION', 'VS', 'VERT SECTION', 'VERTICAL SECTION FT', 'VERTICAL SECTION (FT)']);
            const doglegIdx = resolveIndex(['DOGLEG RATE', 'DOGLEG', 'DLS', 'DOGLEG RATE FT', 'DOGLEG RATE (DEG/100FT)']);

            aoa.slice(hi + 1).forEach(row => {
                if (!row || !row.some((c: any) => c !== '')) return;
                const w   = wIdx !== -1 ? _s(row[wIdx]) : '';
                const md  = mdIdx !== -1 ? _n(row[mdIdx]) : 0;
                const tvd = tvdIdx !== -1 ? _n(row[tvdIdx]) : 0;

                const inc = incIdx !== -1 ? row[incIdx] : null;
                const azim = azimIdx !== -1 ? row[azimIdx] : null;
                const subSea = subSeaIdx !== -1 ? row[subSeaIdx] : null;
                const northing = northingIdx !== -1 ? row[northingIdx] : null;
                const nsRaw = nsIdx !== -1 ? row[nsIdx] : null;
                const easting = eastingIdx !== -1 ? row[eastingIdx] : null;
                const ewRaw = ewIdx !== -1 ? row[ewIdx] : null;
                const northingM = northingMIdx !== -1 ? row[northingMIdx] : null;
                const eastingM = eastingMIdx !== -1 ? row[eastingMIdx] : null;
                const verticalSection = verticalSectionIdx !== -1 ? row[verticalSectionIdx] : null;
                const dogleg = doglegIdx !== -1 ? row[doglegIdx] : null;

                const pVal = (v: any): number | undefined => {
                    if (v == null || v === '') return undefined;
                    const parsed = parseFloat(String(v).replace(',', '.'));
                    return isNaN(parsed) ? undefined : Math.round(parsed * 1000) / 1000;
                };

                const nsVal = nsRaw ? _s(nsRaw).toUpperCase().charAt(0) : undefined;
                const ewVal = ewRaw ? _s(ewRaw).toUpperCase().charAt(0) : undefined;

                if (w && md > 0) {
                    if (!surveyMap[w]) surveyMap[w] = [];
                    surveyMap[w].push({
                        md,
                        tvd: tvd > 0 ? tvd : md,
                        inc: pVal(inc),
                        azim: pVal(azim),
                        subSea: pVal(subSea),
                        northing: pVal(northing),
                        ns: (nsVal === 'N' || nsVal === 'S') ? nsVal as 'N' | 'S' : undefined,
                        easting: pVal(easting),
                        ew: (ewVal === 'E' || ewVal === 'W') ? ewVal as 'E' | 'W' : undefined,
                        northingM: pVal(northingM),
                        eastingM: pVal(eastingM),
                        verticalSection: pVal(verticalSection),
                        dogleg: pVal(dogleg)
                    });
                }
            });
            Object.keys(surveyMap).forEach(w => surveyMap[w].sort((a, b) => a.md - b.md));
        }
        progress(50);

        // ── 3. Hoja de datos de diseño ───────────────────────────────────────
        const dsSheet = wb.SheetNames.find(n => {
            const u = n.toUpperCase();
            return u.includes('DATA DISE') || u.includes('DISE') || u.includes('DATA');
        }) ?? wb.SheetNames[0];

        const aoa: any[][] = xlsxUtils.sheet_to_json(wb.Sheets[dsSheet], { header: 1, defval: '' });
        progress(60);

        let hdrIdx = 0;
        for (let i = 0; i < Math.min(aoa.length, 15); i++) {
            const r = (aoa[i] || []).map((c: any) => _norm(String(c))).join('|');
            if (r.includes('POZO') || r.includes('CAMPO') || r.includes('DISENO')) { hdrIdx = i; break; }
        }
        const hdrs = (aoa[hdrIdx] || []).map((c: any) => _s(c));
        const rawRows = aoa.slice(hdrIdx + 1).filter((r: any[]) => r && r.some((c: any) => c !== ''));
        const total = rawRows.length;
        const jsonRows: Record<string, any>[] = [];

        for (let i = 0; i < total; i++) {
            const row = rawRows[i];
            const o: Record<string, any> = {};
            hdrs.forEach((h: string, idx: number) => { if (h) o[h] = row[idx] ?? ''; });
            if (_s(_get(o, ['POZO'])) !== '' || _s(_get(o, ['DISENO #'])) !== '') {
                jsonRows.push(o);
            }
            if (i % 50 === 0) {
                progress(Math.floor(60 + (i / total) * 40));
            }
        }

        progress(100);
        self.postMessage({ type: 'done', surveys: surveyMap, designs: jsonRows });

    } catch (err) {
        self.postMessage({ type: 'error', message: String(err) });
    }
};
