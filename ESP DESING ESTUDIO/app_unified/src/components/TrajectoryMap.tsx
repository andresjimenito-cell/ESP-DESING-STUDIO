import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import proj4 from 'proj4';
import 'leaflet/dist/leaflet.css';
import { MapPin, Sliders, AlertTriangle } from 'lucide-react';
import { SurveyPoint, SystemParams } from '../types';

// Registrar proyecciones cartográficas comunes en Colombia
proj4.defs('EPSG:9377', '+proj=tmerc +lat_0=4 +lon_0=-73 +k=1 +x_0=5000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
proj4.defs('EPSG:3116', '+proj=tmerc +lat_0=4.596200417 +lon_0=-74.077507917 +k=1 +x_0=1000000 +y_0=1000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
proj4.defs('EPSG:32618', '+proj=utm +zone=18 +datum=WGS84 +units=m +no_defs');

interface TrajectoryMapProps {
    survey: SurveyPoint[];
    params: SystemParams;
    spoolerAzimuth: number;
}

// Opciones de Sistemas de Coordenadas
const PROJECTION_OPTIONS = [
    { code: 'AUTO', name: 'Autodetectar Sistema' },
    { code: 'EPSG:4326', name: 'Grados Decimales (WGS84)' },
    { code: 'EPSG:9377', name: 'Origen Único (MAGNA-SIRGAS)' },
    { code: 'EPSG:3116', name: 'Origen Bogotá (MAGNA-SIRGAS)' },
    { code: 'EPSG:32618', name: 'UTM Zona 18N (WGS84)' },
];

// Validador de coordenadas Lat/Lon
const isValidLatLng = (coord: any): coord is [number, number] => {
    return Array.isArray(coord) && 
           coord.length === 2 && 
           typeof coord[0] === 'number' && 
           !isNaN(coord[0]) && 
           isFinite(coord[0]) &&
           Math.abs(coord[0]) <= 90 &&
           typeof coord[1] === 'number' && 
           !isNaN(coord[1]) && 
           isFinite(coord[1]) &&
           Math.abs(coord[1]) <= 180;
};

export const TrajectoryMap: React.FC<TrajectoryMapProps> = ({ survey, params, spoolerAzimuth }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markersGroupRef = useRef<L.FeatureGroup | null>(null);

    const [selectedProj, setSelectedProj] = useState<string>('AUTO');
    const [detectedProj, setDetectedProj] = useState<string>('EPSG:4326');
    const [isSimulated, setIsSimulated] = useState<boolean>(false);

    // Controles para capas WMS de la ANH (activados por defecto)
    const [showAnhTierras, setShowAnhTierras] = useState<boolean>(true);
    const [showAnhPozos, setShowAnhPozos] = useState<boolean>(true);

    // Pozos ANH cercanos consultados por API REST
    const [nearbyWells, setNearbyWells] = useState<any[]>([]);

    // Ajustes del Spooler y el Cono de Rango fijos
    const spoolerDist = 30;
    const coneAngle = 30;

    // 1. Resolver las coordenadas del cabezal (Wellhead) de forma ultra rápida (solo la primera línea georreferenciada)
    const coordinatesData = useMemo(() => {
        const defaultLat = 4.598;
        const defaultLon = -74.076;

        console.log("TrajectoryMap: survey length =", survey?.length);

        if (!survey || survey.length === 0) {
            console.warn("TrajectoryMap: survey is empty");
            return { wellhead: [defaultLat, defaultLon] as [number, number], simulated: true, activeProj: 'EPSG:4326' };
        }

        // Buscar la primera fila que tenga datos de coordenadas
        const firstWithCoords = survey.find(pt => 
            (pt.northing !== undefined && pt.easting !== undefined) || 
            (pt.northingM !== undefined && pt.eastingM !== undefined)
        );

        console.log("TrajectoryMap: first point with coords =", firstWithCoords);

        // Si no hay coordenadas absolutas, simulamos usando Bogotá como origen
        if (!firstWithCoords) {
            console.warn("TrajectoryMap: no coordinates found in survey. Simulating...");
            return { wellhead: [defaultLat, defaultLon] as [number, number], simulated: true, activeProj: 'EPSG:4326' };
        }

        // Determinar si priorizar metros
        let isMeters = false;
        let startN = 0;
        let startE = 0;

        if (firstWithCoords.northingM !== undefined && firstWithCoords.eastingM !== undefined) {
            startN = firstWithCoords.northingM;
            startE = firstWithCoords.eastingM;
            isMeters = true;
        } else if (firstWithCoords.northing !== undefined && firstWithCoords.easting !== undefined) {
            startN = firstWithCoords.northing;
            startE = firstWithCoords.easting;
            isMeters = false;
        }

        console.log("TrajectoryMap: startN =", startN, "startE =", startE, "isMeters =", isMeters);

        // Si es AUTO, detectar según los valores del punto
        let activeProj = selectedProj;
        if (selectedProj === 'AUTO') {
            const valN = isMeters ? startN : startN * 0.3048;
            const valE = isMeters ? startE : startE * 0.3048;

            if (Math.abs(valN) < 180 && Math.abs(valE) < 180) {
                activeProj = 'EPSG:4326';
            } else if (valN >= 1800000 && valN <= 2400000 && valE >= 4500000 && valE <= 5300000) {
                activeProj = 'EPSG:9377';
            } else if (valN >= 800000 && valN <= 1300000 && valE >= 800000 && valE <= 1300000) {
                activeProj = 'EPSG:3116';
            } else {
                activeProj = 'EPSG:32618';
            }
        }

        console.log("TrajectoryMap: activeProj =", activeProj);

        let wellheadLat = defaultLat;
        let wellheadLon = defaultLon;
        let nVal = isMeters ? startN : startN * 0.3048;
        let eVal = isMeters ? startE : startE * 0.3048;

        if (activeProj === 'EPSG:4326') {
            wellheadLat = firstWithCoords.northing ?? firstWithCoords.northingM ?? defaultLat;
            wellheadLon = firstWithCoords.easting ?? firstWithCoords.eastingM ?? defaultLon;
        } else {
            try {
                const [lon, lat] = proj4(activeProj, 'EPSG:4326', [eVal, nVal]);
                wellheadLat = lat;
                wellheadLon = lon;
            } catch (err) {
                console.error("TrajectoryMap: proj4 conversion error:", err);
                wellheadLat = defaultLat;
                wellheadLon = defaultLon;
            }
        }

        console.log("TrajectoryMap: resolved wellhead coordinate =", [wellheadLat, wellheadLon]);

        if (!isValidLatLng([wellheadLat, wellheadLon])) {
            console.warn("TrajectoryMap: resolved coordinate is invalid, falling back to Bogotá");
            wellheadLat = defaultLat;
            wellheadLon = defaultLon;
        }

        return { 
            wellhead: [wellheadLat, wellheadLon] as [number, number], 
            simulated: false, 
            activeProj 
        };
    }, [survey, selectedProj]);

    // 2. Sincronizar estados de proyección y simulación de forma segura en useEffect
    useEffect(() => {
        setDetectedProj(coordinatesData.activeProj);
        setIsSimulated(coordinatesData.simulated);
    }, [coordinatesData.activeProj, coordinatesData.simulated]);

    // 2.5 Consultar pozos cercanos en la base de datos de la ANH
    useEffect(() => {
        const wellhead = coordinatesData.wellhead;
        if (!wellhead || coordinatesData.simulated || !showAnhPozos) {
            setNearbyWells([]);
            return;
        }

        const fetchNearbyWells = async () => {
            const [lat, lon] = wellhead;
            // Consultar a la ANH pozos en un radio de 20 km (20000 metros)
            const url = `https://geovisor.anh.gov.co/server/rest/services/GEOVISOR_v32/ANH_InsGDB/MapServer/1/query?geometry=${lon},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=20000&units=esriSRUnit_Meter&outFields=WELL_NAME,GEOLOGIC_P,WELL_LATIT,WELL_LONGI&outSR=4326&returnGeometry=true&f=json`;

            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error("HTTP error " + response.status);
                const data = await response.json();
                if (data && data.features) {
                    console.log("Pozos ANH recuperados:", data.features.length);
                    const formatted = data.features.map((f: any) => {
                        const attrs = f.attributes || {};
                        const geom = f.geometry || {};
                        const wLat = attrs.WELL_LATIT || geom.y;
                        const wLon = attrs.WELL_LONGI || geom.x;
                        return {
                            name: attrs.WELL_NAME || "Pozo ANH",
                            province: attrs.GEOLOGIC_P || "N/A",
                            lat: wLat,
                            lon: wLon
                        };
                    }).filter((w: any) => typeof w.lat === 'number' && typeof w.lon === 'number');
                    setNearbyWells(formatted);
                }
            } catch (err) {
                console.error("Error al consultar pozos cercanos en ANH:", err);
            }
        };

        const timer = setTimeout(() => {
            fetchNearbyWells();
        }, 600);

        return () => clearTimeout(timer);
    }, [coordinatesData.wellhead, coordinatesData.simulated, showAnhPozos]);

    // 3. Inicializar Mapa (Leaflet puro en useEffect)
    useEffect(() => {
        if (!mapContainerRef.current) return;

        // Limpieza preventiva si ya hay un mapa en la referencia
        if (mapInstanceRef.current) {
            try {
                mapInstanceRef.current.stop();
                mapInstanceRef.current.remove();
            } catch (e) {
                console.error("Error removing old map instance", e);
            }
            mapInstanceRef.current = null;
        }

        // Limpieza absoluta del contenedor DOM y metadatos de Leaflet
        const container = mapContainerRef.current;
        if ((container as any)._leaflet_id) {
            delete (container as any)._leaflet_id;
        }
        container.innerHTML = '';

        const centerCoords = isValidLatLng(coordinatesData.wellhead) ? coordinatesData.wellhead : ([4.598, -74.076] as L.LatLngTuple);

        // Crear instancia del mapa - Deshabilitamos todas las animaciones para evitar desbordamiento en el DOM y errores de posicionamiento (_leaflet_pos)
        const map = L.map(container, {
            center: centerCoords,
            zoom: 17,
            zoomControl: false,
            zoomAnimation: false,
            fadeAnimation: false,
            markerZoomAnimation: false,
            maxZoom: 21
        });
        mapInstanceRef.current = map;

        // Añadir control de zoom manual
        L.control.zoom({ position: 'topright' }).addTo(map);

        // Capa base de imágenes satelitales (Esri World Imagery) - Rápida, liviana y de alta resolución
        // Usamos maxNativeZoom: 18 para que Leaflet estire las imágenes del nivel 18 en lugar de intentar pedir teselas inexistentes
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 21,
            maxNativeZoom: 18,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USDA, USGS, GeoEye, and the GIS User Community'
        }).addTo(map);

        // Inicializar grupo de marcadores y trayectoria
        const markersGroup = L.featureGroup().addTo(map);
        markersGroupRef.current = markersGroup;

        // Solucionar tamaño de contenedor inicial con timeouts y resize listener seguros
        const timer1 = setTimeout(() => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.invalidateSize();
            }
        }, 100);
        const timer2 = setTimeout(() => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.invalidateSize();
            }
        }, 400);

        const handleResize = () => {
            if (mapInstanceRef.current) {
                try {
                    mapInstanceRef.current.invalidateSize();
                } catch (e) {
                    // Ignore
                }
            }
        };
        window.addEventListener('resize', handleResize);

        // Limpieza al desmontar sincrónica y segura para evitar errores en elementos del DOM de Leaflet
        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            window.removeEventListener('resize', handleResize);
            if (mapInstanceRef.current) {
                try {
                    mapInstanceRef.current.stop();
                    mapInstanceRef.current.remove();
                } catch (e) {
                    console.error("Error removing Leaflet map:", e);
                }
                mapInstanceRef.current = null;
            }
            markersGroupRef.current = null;
        };
    }, []);

    // 4. Actualizar marcadores, trayectoria y elementos del mapa
    useEffect(() => {
        const map = mapInstanceRef.current;
        console.log("TrajectoryMap layer update hook: mapInstanceRef =", !!map, "coordinatesData =", coordinatesData);
        if (!map) return;

        // Limpiar marcadores y trayectoria anteriores
        if (markersGroupRef.current) {
            markersGroupRef.current.clearLayers();
        }

        // Forzar redibujado de tamaño
        map.invalidateSize();

        const wellhead = (isValidLatLng(coordinatesData.wellhead) ? coordinatesData.wellhead : [4.598, -74.076]) as [number, number];

        // Centrar mapa si cambian las coordenadas (sin animación)
        map.setView(wellhead, map.getZoom(), { animate: false });

        // B. Crear Marcador del Cabezal del Pozo (Rig) usando L.circleMarker vector (mucho más liviano y libre de errores de DOM)
        if (isValidLatLng(wellhead)) {
            // Rig Outer Glow
            L.circleMarker(wellhead, {
                radius: 18,
                fillColor: '#22d3ee',
                color: 'transparent',
                fillOpacity: 0.25
            }).addTo(markersGroupRef.current!);

            // Rig Center
            const wellMarker = L.circleMarker(wellhead, {
                radius: 8,
                fillColor: '#0891b2',
                color: '#ffffff',
                weight: 2,
                fillOpacity: 0.9
            }).addTo(markersGroupRef.current!);

            wellMarker.bindPopup(`
                <div class="p-2 space-y-1">
                    <p class="font-black text-xs uppercase tracking-wider text-cyan-600">${params.metadata.wellName || 'Pozo'}</p>
                    <p class="text-[10px] text-slate-500">Lat: ${wellhead[0].toFixed(6)}</p>
                    <p class="text-[10px] text-slate-500">Lon: ${wellhead[1].toFixed(6)}</p>
                    <p class="text-[9px] text-amber-600 font-bold uppercase mt-1">${isSimulated ? '⚠️ COORDENADAS SIMULADAS' : '✓ SURVEY GEORREFERENCIADO'}</p>
                </div>
            `, { autoPan: false });
        }

        const R_EARTH_FT = 20925646.3;

        // Función auxiliar para calcular coordenadas relativas
        const getPointAtDir = (center: [number, number], angle: number, distFt: number): [number, number] => {
            const rad = angle * (Math.PI / 180);
            const dx = distFt * Math.sin(rad);
            const dy = distFt * Math.cos(rad);
            const dLat = (dy / R_EARTH_FT) * (180 / Math.PI);
            const dLon = (dx / (R_EARTH_FT * Math.cos(center[0] * Math.PI / 180))) * (180 / Math.PI);
            return [center[0] + dLat, center[1] + dLon];
        };

        // C. Dibujar Cono de Rango (Sector de Azimut Permitido)
        const startAngle = spoolerAzimuth - coneAngle;
        const endAngle = spoolerAzimuth + coneAngle;
        const coneRadiusFt = Math.max(60, spoolerDist * 1.3);

        const getArcCoords = (center: [number, number], startAng: number, endAng: number, radiusFt: number): [number, number][] => {
            const coords: [number, number][] = [center];
            const steps = 16;
            for (let i = 0; i <= steps; i++) {
                const ang = startAng + (endAng - startAng) * (i / steps);
                const rad = ang * (Math.PI / 180);
                const dx = radiusFt * Math.sin(rad);
                const dy = radiusFt * Math.cos(rad);
                const dLat = (dy / R_EARTH_FT) * (180 / Math.PI);
                const dLon = (dx / (R_EARTH_FT * Math.cos(center[0] * Math.PI / 180))) * (180 / Math.PI);
                coords.push([center[0] + dLat, center[1] + dLon]);
            }
            coords.push(center);
            return coords;
        };

        const sectorCoords = getArcCoords(wellhead, startAngle, endAngle, coneRadiusFt);

        let limitStartCoords: [number, number] = wellhead;
        let limitEndCoords: [number, number] = wellhead;

        if (isValidLatLng(wellhead) && sectorCoords.length > 0) {
            L.polygon(sectorCoords, {
                color: '#22d3ee',
                weight: 1.5,
                dashArray: '3, 4',
                fillColor: '#22d3ee',
                fillOpacity: 0.12,
                interactive: false
            }).addTo(markersGroupRef.current!);

            limitStartCoords = getPointAtDir(wellhead, startAngle, coneRadiusFt);
            limitEndCoords = getPointAtDir(wellhead, endAngle, coneRadiusFt);

            L.marker(limitStartCoords, {
                icon: L.divIcon({
                    className: 'bg-transparent border-none text-[8px] text-cyan-300 font-mono font-bold whitespace-nowrap',
                    html: `<span style="background-color: rgba(15, 23, 42, 0.85); padding: 2px 4px; border: 1px solid rgba(34, 211, 238, 0.3); border-radius: 4px; color: #22d3ee;">${Math.round((startAngle + 360) % 360)}°</span>`,
                    iconAnchor: [15, 5]
                })
            }).addTo(markersGroupRef.current!);

            L.marker(limitEndCoords, {
                icon: L.divIcon({
                    className: 'bg-transparent border-none text-[8px] text-cyan-300 font-mono font-bold whitespace-nowrap',
                    html: `<span style="background-color: rgba(15, 23, 42, 0.85); padding: 2px 4px; border: 1px solid rgba(34, 211, 238, 0.3); border-radius: 4px; color: #22d3ee;">${Math.round((endAngle + 360) % 360)}°</span>`,
                    iconAnchor: [15, 5]
                })
            }).addTo(markersGroupRef.current!);
        }

        // D. Dibujar Spooler en Superficie usando L.circleMarker vector (el azimut viene pre-calculado de forma segura)
        const spoolerCoords = getPointAtDir(wellhead, spoolerAzimuth, spoolerDist);

        if (isValidLatLng(spoolerCoords)) {
            // Spooler Outer Glow
            L.circleMarker(spoolerCoords, {
                radius: 14,
                fillColor: '#f59e0b',
                color: 'transparent',
                fillOpacity: 0.25
            }).addTo(markersGroupRef.current!);

            // Spooler Center
            const spoolerMarker = L.circleMarker(spoolerCoords, {
                radius: 6,
                fillColor: '#d97706',
                color: '#ffffff',
                weight: 1.5,
                fillOpacity: 0.9
            }).addTo(markersGroupRef.current!);

            spoolerMarker.bindPopup(`
                <div class="p-2 space-y-1">
                    <p class="font-black text-xs uppercase tracking-wider text-amber-600">SPOOLER ALS</p>
                    <p class="text-[10px] text-slate-500">Distancia: ${spoolerDist} ft</p>
                    <p class="text-[10px] text-slate-500">Azimut: ${spoolerAzimuth}°</p>
                </div>
            `, { autoPan: false });
        }

        // E. Cable de conexión
        if (isValidLatLng(wellhead) && isValidLatLng(spoolerCoords)) {
            L.polyline([wellhead, spoolerCoords], {
                color: '#f43f5e',
                weight: 1.5,
                dashArray: '4, 4',
                opacity: 0.8
            }).addTo(markersGroupRef.current!);
        }

        // F. Dibujar Brújula sobre el cabezal del pozo (Wellhead)
        if (isValidLatLng(wellhead)) {
            // Anillo interior: 15 ft (4.572 m)
            L.circle(wellhead, {
                radius: 4.572,
                color: 'rgba(255, 255, 255, 0.25)',
                weight: 0.8,
                fill: false,
                dashArray: '2, 3',
                interactive: false
            }).addTo(markersGroupRef.current!);

            // Anillo exterior: 30 ft (9.144 m)
            L.circle(wellhead, {
                radius: 9.144,
                color: 'rgba(255, 255, 255, 0.4)',
                weight: 1.0,
                fill: false,
                dashArray: '4, 4',
                interactive: false
            }).addTo(markersGroupRef.current!);

            // Líneas y marcas cardinales N, S, E, W
            const cardDirs = [
                { angle: 0, label: 'N', color: '#ef4444' },
                { angle: 90, label: 'E', color: '#38bdf8' },
                { angle: 180, label: 'S', color: '#94a3b8' },
                { angle: 270, label: 'W', color: '#94a3b8' }
            ];

            cardDirs.forEach(dir => {
                const startPoint = getPointAtDir(wellhead, dir.angle, 5);
                const endPoint = getPointAtDir(wellhead, dir.angle, 40);
                const labelPoint = getPointAtDir(wellhead, dir.angle, 48);

                L.polyline([startPoint, endPoint], {
                    color: 'rgba(255, 255, 255, 0.25)',
                    weight: 0.8,
                    interactive: false
                }).addTo(markersGroupRef.current!);

                L.marker(labelPoint, {
                    icon: L.divIcon({
                        className: 'bg-transparent border-none text-[8px] font-black text-center font-mono select-none',
                        html: `<span style="color: ${dir.color}; text-shadow: 0 0 2px rgba(0,0,0,0.95);">${dir.label}</span>`,
                        iconSize: [8, 8],
                        iconAnchor: [4, 4]
                    }),
                    interactive: false
                }).addTo(markersGroupRef.current!);
            });
        }

        // G. Dibujar Trayectoria Proyectada en Planta (difuminada/punteada)
        const getProjectedTrajectory = (): [number, number][] => {
            if (!survey || survey.length === 0) return [];
            
            // Downsamplear a un máximo de ~100 puntos para optimizar rendimiento de rendering y evitar freezes
            const maxPoints = 100;
            const step = Math.max(1, Math.floor(survey.length / maxPoints));
            const pointsToProcess: any[] = [];
            for (let i = 0; i < survey.length; i += step) {
                pointsToProcess.push(survey[i]);
            }
            if (survey.length > 0 && pointsToProcess[pointsToProcess.length - 1] !== survey[survey.length - 1]) {
                pointsToProcess.push(survey[survey.length - 1]);
            }

            const coords: [number, number][] = [wellhead];
            let curX = 0; // East (ft)
            let curY = 0; // North (ft)
            const DEG2RAD = Math.PI / 180;

            for (let i = 1; i < pointsToProcess.length; i++) {
                const prev = pointsToProcess[i - 1];
                const curr = pointsToProcess[i];
                const dMD = curr.md - prev.md;
                if (dMD <= 0) continue;

                const avgInc = (((prev.inc ?? 0) + (curr.inc ?? 0)) / 2) * DEG2RAD;
                const avgAz = (((prev.azim ?? 0) + (curr.azim ?? 0)) / 2) * DEG2RAD;

                curX += dMD * Math.sin(avgInc) * Math.sin(avgAz);
                curY += dMD * Math.sin(avgInc) * Math.cos(avgAz);

                const dLat = (curY / R_EARTH_FT) * (180 / Math.PI);
                const dLon = (curX / (R_EARTH_FT * Math.cos(wellhead[0] * Math.PI / 180))) * (180 / Math.PI);
                coords.push([wellhead[0] + dLat, wellhead[1] + dLon]);
            }
            return coords;
        };

        const trajCoords = getProjectedTrajectory();
        if (trajCoords.length > 0) {
            L.polyline(trajCoords, {
                color: '#22d3ee',
                weight: 1.5,
                dashArray: '3, 4',
                opacity: 0.45,
                interactive: false
            }).addTo(markersGroupRef.current!);

            // Marcador en planta del final del pozo (TD)
            const tdCoords = trajCoords[trajCoords.length - 1];
            if (isValidLatLng(tdCoords)) {
                L.circleMarker(tdCoords, {
                    radius: 3,
                    fillColor: '#22d3ee',
                    color: '#ffffff',
                    weight: 1,
                    fillOpacity: 0.4,
                    interactive: false
                }).addTo(markersGroupRef.current!);
            }
        }

        // H. Limpiar y Cargar Capas WMS de la ANH
        map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer.WMS) {
                try {
                    map.removeLayer(layer);
                } catch (e) {
                    console.error("Error removing WMS layer:", e);
                }
            }
        });

        if (showAnhTierras) {
            L.tileLayer.wms('https://geovisor.anh.gov.co/server/services/GEOVISOR_v32/ANH_TIERRAS_EGDB_ATTACH/MapServer/WMSServer', {
                layers: '0,1,2,3,4,5,6,7,8,9,10',
                format: 'image/png',
                transparent: true,
                version: '1.1.1',
                opacity: 0.55,
                attribution: '&copy; ANH Colombia - Tierras'
            }).addTo(map);
        }

        if (showAnhPozos) {
            L.tileLayer.wms('https://geovisor.anh.gov.co/server/services/GEOVISOR_v32/ANH_InsGDB/MapServer/WMSServer', {
                layers: '0,1,2,3,4',
                format: 'image/png',
                transparent: true,
                version: '1.1.1',
                opacity: 0.8,
                attribution: '&copy; ANH Colombia - Infraestructura'
            }).addTo(map);
        }

        // I. Dibujar pozos cercanos recuperados de la consulta REST de la ANH
        if (showAnhPozos && nearbyWells.length > 0) {
            nearbyWells.forEach((w) => {
                const coords: [number, number] = [w.lat, w.lon];
                if (isValidLatLng(coords)) {
                    L.circleMarker(coords, {
                        radius: 4,
                        fillColor: '#ea580c', // Naranja
                        color: '#ffffff',
                        weight: 1,
                        fillOpacity: 0.85
                    }).addTo(markersGroupRef.current!)
                    .bindTooltip(`
                        <div style="font-family: monospace; font-size: 8px; line-height: 1.2;">
                            <b style="color: #ea580c; font-size: 9px;">${w.name}</b>
                            ${w.province !== 'N/A' ? `<br/><span style="color: #94a3b8;">Prov: ${w.province}</span>` : ''}
                        </div>
                    `, {
                        permanent: true,
                        direction: 'top',
                        className: 'bg-slate-950/95 border border-orange-500/20 px-1.5 py-1 rounded shadow-2xl text-white font-mono'
                    });
                }
            });
        }

        // Ajustar bounds del mapa de forma segura para incluir todos los elementos
        const bounds = L.latLngBounds([wellhead, spoolerCoords]);
        if (sectorCoords.length > 0) {
            sectorCoords.forEach(c => bounds.extend(c));
        }
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [60, 60], animate: false, maxZoom: 19 });
        }
    }, [coordinatesData, params, spoolerAzimuth, spoolerDist, coneAngle, showAnhTierras, showAnhPozos, nearbyWells]);

    return (
        <div className="relative w-full h-full flex flex-col min-h-[480px]">
            {/* Header del Control del Mapa - Minimalista con Capas ANH */}
            <div className="absolute top-4 left-4 z-[1000] flex flex-wrap gap-2 items-center bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 shadow-2xl max-w-[calc(100%-20px)] text-white">
                <div className="flex items-center gap-1.5 pr-2">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] font-black text-white uppercase tracking-wider">
                        {params.metadata.wellName || 'Pozo'}
                    </span>
                </div>

                {/* Selector de Proyección */}
                <div className="flex items-center gap-1 pl-2 border-l border-white/10">
                    <Sliders className="w-3 h-3 text-slate-400" />
                    <select
                        value={selectedProj}
                        onChange={(e) => setSelectedProj(e.target.value)}
                        className="bg-slate-800 text-white text-[9px] font-bold border border-white/5 rounded-lg px-2 py-1 outline-none cursor-pointer hover:bg-slate-700 transition-all uppercase tracking-wider"
                    >
                        {PROJECTION_OPTIONS.map(opt => (
                            <option key={opt.code} value={opt.code}>{opt.name}</option>
                        ))}
                    </select>
                </div>

                {/* Indicador de Proyección Detectada */}
                {selectedProj === 'AUTO' && (
                    <div className="text-[8px] bg-slate-800/80 border border-white/5 px-2 py-1 rounded-md text-slate-300 font-mono">
                        Detec: {detectedProj === 'EPSG:4326' ? 'WGS84' : detectedProj === 'EPSG:9377' ? 'Origen Único' : detectedProj === 'EPSG:3116' ? 'Origen Bogotá' : 'UTM 18N'}
                    </div>
                )}

                {/* Capas ANH */}
                <div className="flex items-center gap-3 pl-2 border-l border-white/10 text-[8px] font-bold">
                    <label className="flex items-center gap-1 cursor-pointer select-none text-slate-300 hover:text-white transition-all uppercase tracking-wider">
                        <input
                            type="checkbox"
                            checked={showAnhTierras}
                            onChange={(e) => setShowAnhTierras(e.target.checked)}
                            className="w-2.5 h-2.5 rounded bg-slate-800 border-white/10 cursor-pointer accent-cyan-500"
                        />
                        <span>Tierras ANH</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer select-none text-slate-300 hover:text-white transition-all uppercase tracking-wider">
                        <input
                            type="checkbox"
                            checked={showAnhPozos}
                            onChange={(e) => setShowAnhPozos(e.target.checked)}
                            className="w-2.5 h-2.5 rounded bg-slate-800 border-white/10 cursor-pointer accent-cyan-500"
                        />
                        <span>Pozos ANH</span>
                    </label>
                </div>
            </div>

            {/* Aviso de Simulación si no hay coordenadas absolutas */}
            {isSimulated && (
                <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-2 bg-amber-950/90 backdrop-blur-md px-3 py-2 rounded-xl border border-amber-500/30 shadow-2xl text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-[9px] font-bold uppercase tracking-wider leading-relaxed">
                        Survey sin georreferencia. Ubicación simulada en Bogotá.<br />
                        <span className="text-[8px] opacity-70">Para ver ubicación real, agrega columnas de Lat/Lon en el Excel.</span>
                    </p>
                </div>
            )}

            {/* Contenedor del Mapa de Leaflet */}
            <div ref={mapContainerRef} className="flex-1 w-full h-full rounded-2xl overflow-hidden border border-white/5 z-0" />
        </div>
    );
};
