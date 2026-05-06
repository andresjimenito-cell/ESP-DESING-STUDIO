/**
 * Utility functions for extracting and normalizing data from Excel/JSON rows.
 */

export const s_ext = (val: any): string => (val == null ? '' : String(val).trim());

export const d_ext = (val: any): string => {
    if (val == null || val === '') return new Date().toISOString().split('T')[0];
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val === 'number' && val > 30000 && val < 60000) {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return d.toISOString().split('T')[0];
    }
    let s = String(val).trim().toLowerCase();
    const esMonths: Record<string, string> = {
        'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
    };
    s = s.replace(/\./g, '');
    for (const [abbr, num] of Object.entries(esMonths)) {
        if (s.includes(abbr)) { s = s.replace(abbr, num); break; }
    }
    s = s.replace(/[\/\s]/g, '-');
    const parts = s.split('-').filter(p => p.length > 0);
    if (parts.length === 3 && parts[0].length <= 2) {
        let day = parts[0], month = parts[1], year = parts[2];
        if (year.length === 2) year = '20' + year;
        if (day.length === 1) day = '0' + day;
        if (month.length === 1) month = '0' + month;
        const iso = `${year}-${month}-${day}`;
        if (!isNaN(new Date(iso).getTime())) return iso;
    }
    const finalD = new Date(s);
    return isNaN(finalD.getTime()) ? new Date().toISOString().split('T')[0] : finalD.toISOString().split('T')[0];
};

export const n_ext = (v: any): number => {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    let s = String(v).trim().replace(/\s+/g, ' ');

    if (s.includes('/')) {
        const match = s.match(/(\d+)?[\s-]?(\d+)\/(\d+)/);
        if (match) {
            const whole = parseFloat(match[1] || '0');
            const num = parseFloat(match[2]);
            const den = parseFloat(match[3]);
            return Number((whole + (num / den)).toFixed(3));
        }
    }

    let clean = s.replace(/[^*0-9.,-]/g, '').replace(/\*.*$/, '');
    if (clean.includes(',') && clean.includes('.')) {
        if (clean.indexOf(',') > clean.indexOf('.')) clean = clean.replace(/\./g, '').replace(',', '.');
        else clean = clean.replace(/,/g, '');
    } else if (clean.includes(',')) {
        if (clean.split(',').pop()?.length === 3 && clean.split(',').length > 1) clean = clean.replace(/,/g, '');
        else clean = clean.replace(',', '.');
    }
    const res = parseFloat(clean);
    return isNaN(res) ? 0 : Number(res.toFixed(3));
};

export const norm_ext = (str: string) =>
    String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9_]/g, '');

export const fuzzyWellName = (str: string) => {
    if (!str) return '';
    const n = String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return n.replace(/0+(\d+)/g, '$1');
};

export const get_ext = (row: Record<string, any>, keys: string[]): any => {
    const rowKeys = Object.keys(row);
    const normRowKeys = rowKeys.map(norm_ext);
    for (const key of keys) {
        const nk = norm_ext(key);
        const idxExact = normRowKeys.indexOf(nk);
        if (idxExact !== -1) return row[rowKeys[idxExact]];

        const isCritical = nk.includes('PIP') || nk.includes('THP') || nk.includes('PDP');
        if (nk.length > 3 && !isCritical) {
            const idxPartial = normRowKeys.findIndex(nk2 => nk2 === nk || nk2.startsWith(nk + '_') || nk2.endsWith('_' + nk));
            if (idxPartial !== -1) return row[rowKeys[idxPartial]];
        }
    }
    return null;
};

export const smartMatchExt = (catalog: any[], searchString: string, isMotor: boolean = false, targetHp: number = 0, targetVolts: number = 0, targetAmps: number = 0) => {
    if ((!searchString || catalog.length === 0) && targetHp === 0 && targetVolts === 0 && targetAmps === 0) return null;
    const rawSearch = String(searchString || '').toUpperCase();
    const tokens = rawSearch.split(/[\s\-_,;()\u00A0]/).filter(t => t.length > 0);
    if (tokens.length === 0 && targetHp === 0 && targetVolts === 0 && targetAmps === 0) return null;

    let bestMatch = null; let maxScore = -999;
    let searchHp = isMotor ? (rawSearch.match(/(\d+)\s*HP/)?.[1] ? parseInt(rawSearch.match(/(\d+)\s*HP/)![1], 10) : 0) : 0;

    let expectedSeries = '';
    const seriesMatch = rawSearch.match(/(?:N|S|M|TR)?(3\d{2}|4\d{2}|5\d{2}|6\d{2}|7\d{2})(?:PM|E|S|-|\s)/);
    if (seriesMatch) expectedSeries = seriesMatch[1];
    else {
        const fallBackMatch = rawSearch.match(/(3\d{2}|4\d{2}|5\d{2}|6\d{2}|7\d{2})/);
        if (fallBackMatch) expectedSeries = fallBackMatch[1];
    }

    const hpToMatch = targetHp > 0 ? targetHp : searchHp;

    for (const item of catalog) {
        let score = 0;
        const itemModel = String(item.model || '').toUpperCase();
        const itemSeries = String(item.series || '').toUpperCase();
        const itemTokens = [itemModel, itemSeries, String(item.manufacturer || ''), String(item.brand || ''), String(item.id || '')].map(s => String(s).split(/[\s\-_,;()\u00A0]/)).flat().filter(t => String(t).length > 2);
        const itemStr = itemTokens.join(' ').toUpperCase();

        if (expectedSeries) {
            if (itemSeries.includes(expectedSeries) || itemModel.includes(expectedSeries)) {
                score += 300;
            }
        }

        if (isMotor) {
            if (item.hp) {
                if (hpToMatch > 0) {
                    if (item.hp === hpToMatch) {
                        score += 500;
                    } else if (item.hp > hpToMatch) {
                        const diff = item.hp - hpToMatch;
                        if (diff <= 200) {
                            score += 200 - diff;
                        }
                    } else {
                        const diff = hpToMatch - item.hp;
                        if (diff <= 20) {
                            score += 50 - diff;
                        } else {
                            score -= 300;
                        }
                    }
                } else if (itemStr.includes(String(item.hp)) || rawSearch.includes(String(item.hp))) {
                    score += 100;
                }
            }
            if (targetVolts > 0 && item.voltage) {
                const voltDiff = Math.abs(item.voltage - targetVolts);
                if (voltDiff === 0) score += 300;
                else if (voltDiff < 100) score += 150;
            }
            if (targetAmps > 0 && (item.npAmps || item.amps)) {
                const iAmps = item.npAmps || item.amps;
                const ampDiff = Math.abs(iAmps - targetAmps);
                if (ampDiff === 0) score += 300;
                else if (ampDiff < 5) score += 150;
            }
        }

        for (const t of tokens) {
            if (t.length < 3) continue;
            const ut = t.toUpperCase();
            if (itemTokens.some(it => it === ut)) score += 80;
            else if (itemModel.includes(ut) || ut.includes(itemModel)) score += 60;
            else if (itemStr.includes(ut)) score += 30;
        }
        if (itemModel === rawSearch) score += 500;

        if (score > maxScore) { maxScore = score; bestMatch = item; }
    }
    return maxScore > 40 ? bestMatch : null;
};
