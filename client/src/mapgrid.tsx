import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as h3 from 'h3-js';

const RESOLUTION = 9;

// Veritabanı kimlikleriyle (ID) eşleşen Grup Renkleri
const FACTION_COLORS: Record<number, string> = {
    1: '#FF3333', // Kızıl 
    2: '#3333FF', // Mavi 
    3: '#33FF33', // Yeşil
};

const MapGrid = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);

    useEffect(() => {
        if (mapRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainer.current!,
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', // VOYAGER-H3 için koyu tema
            center: [29.0267, 40.9882], // Kadıköy
            zoom: 14,
        });

        mapRef.current = map;

        map.on('load', () => {
            // Altıgenlerimiz için boş veri kaynağını ekle
            map.addSource('hex-grid', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            });

            // Altıgenleri çizecek katmanı ekle
            map.addLayer({
                id: 'hex-layer',
                type: 'fill',
                source: 'hex-grid',
                paint: {
                    // GeoJSON özelliğinden 'color' (renk) bilgisini kullan
                    'fill-color': ['get', 'color'],
                    'fill-opacity': 0.4,
                    'fill-outline-color': '#ffffff',
                },
            });

            // İlk yükleme
            updateGrid();
        });

        // Kullanıcı haritayı hareket ettirmeyi bıraktığında yeniden hesapla
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
                const response = await fetch('http://localhost:3000/territory/ownership', {
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
                const hexColor = owningFaction ? FACTION_COLORS[owningFaction] : '#444444'; // Sahipsizse gri

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