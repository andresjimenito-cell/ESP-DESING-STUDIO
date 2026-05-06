import { useState, useEffect } from 'react';
import { WellFleetItem, SystemParams, ProductionTest } from '@/types';
import { 
    _cachedFleet, _cachedDesigns, _cachedHistoricalData, 
    setCachedFleet, setCachedDesigns, setCachedHistoricalData, clearCache 
} from '../utils/cacheService';

export const useFleetState = () => {
    const [fleet, setFleet] = useState<WellFleetItem[]>(_cachedFleet);
    const [customDesigns, setCustomDesigns] = useState<Record<string, SystemParams>>(_cachedDesigns);
    const [wellsHistoricalData, setWellsHistoricalData] = useState<Record<string, ProductionTest[]>>(_cachedHistoricalData);
    
    const [selectedWellId, setSelectedWellId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [dataFilter, setDataFilter] = useState<'all' | 'complete' | 'missing' | 'no-tests'>('all');
    const [healthFilter, setHealthFilter] = useState<'all' | 'healthy' | 'caution' | 'critical'>('all');
    const [zoomLevel, setZoomLevel] = useState(1);
    const [wellViewMode, setWellViewMode] = useState<'monitoring' | 'history'>('monitoring');

    // Persistence Effect
    useEffect(() => {
        setCachedFleet(fleet);
        setCachedDesigns(customDesigns);
        setCachedHistoricalData(wellsHistoricalData);
    }, [fleet, customDesigns, wellsHistoricalData]);

    const clearFleet = () => {
        if (confirm("¿Está seguro de limpiar toda la flota y los diseños cargados?")) {
            setFleet([]);
            setCustomDesigns({});
            setWellsHistoricalData({});
            setSelectedWellId(null);
            clearCache();
        }
    };

    return {
        fleet, setFleet,
        customDesigns, setCustomDesigns,
        wellsHistoricalData, setWellsHistoricalData,
        selectedWellId, setSelectedWellId,
        searchTerm, setSearchTerm,
        dataFilter, setDataFilter,
        healthFilter, setHealthFilter,
        zoomLevel, setZoomLevel,
        wellViewMode, setWellViewMode,
        clearFleet
    };
};
