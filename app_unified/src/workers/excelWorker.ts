// ─────────────────────────────────────────────────────────────────────────────
// Excel Web Worker — runs ALL xlsx parsing on a separate thread.
// The main UI thread NEVER blocks.
// ─────────────────────────────────────────────────────────────────────────────
import { read, utils as xlsxUtils } from 'xlsx';

type SurveyPoint = { md: number; tvd: number };

// ── helpers (duplicated here so the worker is self-contained) ─────────────
const _s  = (v: any): string => (v == null ? '' : String(v).trim());
const _n  = (v: any): number => { const p = parseFloat(String(v)); return isNaN(p) ? 0 : Math.round(p * 100) / 100; };
const _norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

const _get = (row: Record<string, any>, keys: string[]): any => {
    const nk = keys.map(_norm);
    // Pass 1: exact match
    for (const h of Object.keys(row)) {
        const n = _norm(h);
        if (nk.some(k => n === k)) return row[h];
    }
    // Pass 2: substring (only for long keys, avoids false positives)
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

        // ── 1. Parse workbook ────────────────────────────────────────────────
        // This is the heavy sync call — now safe on a worker thread
        const wb = read(new Uint8Array(buffer), { type: 'array' });
        progress(30);

        // ── 2. Survey sheet ──────────────────────────────────────────────────
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
            const svGet = (row: any[], keys: string[]) => {
                const nk = keys.map(_norm);
                for (let j = 0; j < hdrs.length; j++) {
                    const n = _norm(hdrs[j]);
                    if (nk.some(k => n === k || (k.length >= 3 && n.includes(k)))) return row[j];
                }
                return null;
            };
            aoa.slice(hi + 1).forEach(row => {
                if (!row || !row.some((c: any) => c !== '')) return;
                const w   = _s(svGet(row, ['POZO', 'WELL', 'NOMBRE']));
                const md  = _n(svGet(row, ['MEASURED DEPTH', 'MD']));
                const tvd = _n(svGet(row, ['VERTICAL DEPTH', 'TVD']));
                if (w && md > 0) {
                    if (!surveyMap[w]) surveyMap[w] = [];
                    surveyMap[w].push({ md, tvd });
                }
            });
            Object.keys(surveyMap).forEach(w => surveyMap[w].sort((a, b) => a.md - b.md));
        }
        progress(50);

        // ── 3. Design data sheet ─────────────────────────────────────────────
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
