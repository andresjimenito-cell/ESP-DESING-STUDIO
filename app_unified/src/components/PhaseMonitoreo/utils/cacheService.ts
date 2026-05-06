import { WellFleetItem, SystemParams, ProductionTest } from '@/types';

export let _cachedFleet: WellFleetItem[] = [];
export let _cachedDesigns: Record<string, SystemParams> = {};
export let _cachedHistoricalData: Record<string, ProductionTest[]> = {};

export const setCachedFleet = (fleet: WellFleetItem[]) => { _cachedFleet = fleet; };
export const setCachedDesigns = (designs: Record<string, SystemParams>) => { _cachedDesigns = designs; };
export const setCachedHistoricalData = (data: Record<string, ProductionTest[]>) => { _cachedHistoricalData = data; };

export const clearCache = () => {
    _cachedFleet = [];
    _cachedDesigns = {};
    _cachedHistoricalData = {};
};
