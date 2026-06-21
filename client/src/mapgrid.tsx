import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as h3 from 'h3-js';
import { API_BASE } from './config';

const RESOLUTION = 9;
const UNCLAIMED_COLOR = '#444444';

const MapGrid = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const factionColors = useRef<Record<number, string>>({});

    useEffect(() => {
        if (mapRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainer.current!,
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
            center: [29.01, 41.01],
            zoom: 11,
        });

        mapRef.current = map;

        // Faction colors fetched after map exists — repaint immediately if map already loaded
        fetch(`${API_BASE}/factions`)
            .then(r => r.ok ? r.json() : [])
            .then((factions: { id: number; color: string }[]) => {
                factionColors.current = Object.fromEntries(factions.map(f => [f.id, f.color]));
                if (map.loaded()) updateGrid();
            })
            .catch(() => {});

        map.on('load', () => {
            map.addSource('hex-grid', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            });

            map.addLayer({
                id: 'hex-layer',
                type: 'fill',
                source: 'hex-grid',
                paint: {
                    'fill-color': ['get', 'color'],
                    'fill-opacity': 0.4,
                    'fill-outline-color': '#ffffff',
                },
            });

            updateGrid();
        });

        map.on('moveend', updateGrid);

        async function updateGrid() {
            const bounds = map.getBounds();

            // 1. H3 için sınırlayıcı kutuyu hesapla
            const polygon = [
                [bounds.getSouth(), bounds.getWest()],
                [bounds.getNorth(), bounds.getWest()],
                [bounds.getNorth(), bounds.getEast()],
                [bounds.getSouth(), bounds.getEast()],
                [bounds.getSouth(), bounds.getWest()], // Döngüyü kapat
            ];

            // 2. Mevcut görünümdeki tüm Hex ID'lerini al
            const visibleHexes = h3.polygonToCells(polygon, RESOLUTION);

            let ownershipMap: Record<string, number> = {};
            try {
                // 3. Arka uçtan sahiplik verilerini getir
                const response = await fetch(`${API_BASE}/territory/ownership`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hexIds: visibleHexes }),
                });

                if (response.ok) {
                    const ownershipData = await response.json();
                    ownershipMap = ownershipData.reduce((acc: any, curr: any) => {
                        acc[curr.h3Index] = curr.factionId;
                        return acc;
                    }, {});
                } else {
                    console.error('Backend returned non-OK status:', response.status);
                }
            } catch (err) {
                console.error('Failed to fetch ownership data (backend might be down or outdated)', err);
            }

            // 4. GeoJSON Özelliklerini Oluştur
            const features: GeoJSON.Feature<GeoJSON.Polygon, { h3Index: string; color: string }>[] = visibleHexes.map((hexId) => {
                const owningFaction = ownershipMap[hexId];
                const hexColor = owningFaction
                    ? (factionColors.current[owningFaction] ?? UNCLAIMED_COLOR)
                    : UNCLAIMED_COLOR;

                return {
                    type: 'Feature' as const,
                    geometry: {
                        type: 'Polygon' as const,
                        // true = GeoJSON'un gerektirdiği [lng, lat] formatında döndür
                        coordinates: [h3.cellToBoundary(hexId, true)],
                    },
                    properties: {
                        h3Index: hexId,
                        color: hexColor,
                    },
                };
            });

            // 5. Harita kaynağını anında güncelle
            const source = map.getSource('hex-grid') as maplibregl.GeoJSONSource | undefined;
            if (source) {
                source.setData({
                    type: 'FeatureCollection',
                    features: features,
                });
            }
        }
        const interval = setInterval(() => {
            if (updateGrid) updateGrid(); // Renkleri yenile
        }, 5000); // 5 saniye

        return () => {
            clearInterval(interval);
            map.remove();
            mapRef.current = null;
        };
    }, []);

    return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
};

export default MapGrid;