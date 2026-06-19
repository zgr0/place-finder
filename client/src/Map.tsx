import { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map.css';
import ReviewModal from './Review';
import MissionPanel from './MissionPanel';
import { useLanguage } from './LanguageContext';

declare global {
  interface Window {
    openReviewModal: (venueName: string) => void;
    loadVenueDetails: (name: string, lat: number, lng: number) => void;
    generateVenueDescription: (name: string, amenity: string, cuisine: string, address: string, opening_hours: string) => void;
  }
}

interface FactionRank {
  id: number;
  name: string;
  color: string;
  memberCount: number;
  totalPoints: number;
}

export default function Map() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [venueError, setVenueError] = useState<string | null>(null);
  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const [selectedVenueForReview, setSelectedVenueForReview] = useState<string | null>(null);
  const [factionRanking, setFactionRanking] = useState<FactionRank[]>([]);
  const [showRanking, setShowRanking] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    (window as any).__popupStrings = {
      loadingDetails: t.loadingDetails,
      loadMissingInfo: t.loadMissingInfo,
      generateDescription: t.generateDescription,
      generating: t.generating,
      viewAndWriteReviews: t.viewAndWriteReviews,
      couldNotLoadVenues: t.couldNotLoadVenues,
    };
  }, [t]);

  useEffect(() => {
    fetch('http://localhost:3000/factions/ranking')
      .then(r => r.ok ? r.json() : [])
      .then(setFactionRanking)
      .catch(() => {});
  }, []);
  const lng = 29.01;
  const lat = 41.01;
  const zoom = 11;
  const API_KEY = import.meta.env.VITE_MAPTILER_KEY;

  useEffect(() => {
    window.openReviewModal = (venueName) => {
      setSelectedVenueForReview(venueName);
    };

    if (map.current || !mapContainer.current) return;

    const supportsWebGL = () => {
      const canvas = document.createElement('canvas');
      return !!(
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')
      );
    };

    if (!supportsWebGL()) {
      setMapError('WebGL is not available in this browser. Please enable WebGL or use a different browser.');
      return;
    }

    console.log('Initializing map container', { lng, lat, zoom, API_KEY });

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://api.maptiler.com/maps/streets/style.json?key=' + API_KEY,
      center: [lng, lat],
      zoom,
      pitch: 45,
      bearing: -17.6,
      canvasContextAttributes: {
        antialias: true,
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: false,
      },
    });

    map.current.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    const currentMap = map.current;
    const canvas = currentMap.getCanvas();

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      console.warn('WebGL context lost, preventing default to allow restore');
      setMapError('WebGL context was lost. Reload the page or try a different browser/GPU driver.');
    };

    const handleContextRestored = () => {
      console.log('WebGL context restored, resizing map');
      setMapError(null);
      currentMap.resize();
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    // Only log errors, never kill the map for non-critical issues
    currentMap.on('error', (error) => {
      console.warn('MapLibre error (non-fatal):', error);
    });

    currentMap.on('load', async () => {
      try {
        // Terrain
        try {
          currentMap.addSource('terrain-dem', {
            type: 'raster-dem',
            url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${API_KEY}`,
            tileSize: 256,
          });
          currentMap.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });
        } catch (e) { console.warn('Terrain failed:', e); }

        // Sky + atmospheric fog (MapLibre v5 API)
        try {
          currentMap.setSky({
            'sky-color': '#1a3a5c',
            'horizon-color': '#87ceeb',
            'fog-color': '#c9dff0',
            'fog-ground-blend': 0.5,
            'horizon-fog-blend': 0.8,
            'sky-horizon-blend': 0.8,
            'atmosphere-blend': 0.8,
          });
        } catch (e) { console.warn('Sky failed:', e); }

        // Directional sun light for building shadows
        try {
          currentMap.setLight({
            anchor: 'map',
            position: [1.5, 210, 30],
            color: '#fffaf0',
            intensity: 0.6,
          });
        } catch (e) { console.warn('Light failed:', e); }

        // Enhance existing building-3d layer instead of adding duplicate
        try {
          if (currentMap.getLayer('building-3d')) {
            currentMap.setPaintProperty('building-3d', 'fill-extrusion-opacity', 0.85);
            currentMap.setPaintProperty('building-3d', 'fill-extrusion-vertical-gradient', true);
          }
        } catch (e) { console.warn('Building layer update failed:', e); }

        console.log('Map loaded, fetching venues');
        const res = await fetch('http://localhost:3000/venues');
        if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
        const json = await res.json();
        console.log('Venues loaded', json);

        currentMap.addSource('venues', {
          type: 'geojson',
          data: json,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
        });

        // Cluster bubbles
        currentMap.addLayer({
          id: 'venue-clusters',
          type: 'circle',
          source: 'venues',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step', ['get', 'point_count'],
              '#ff451b', 50, '#e03e1a', 200, '#b82e10'
            ],
            'circle-radius': [
              'step', ['get', 'point_count'],
              18, 50, 26, 200, 36
            ],
            'circle-opacity': 0.85,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        // Cluster count labels
        currentMap.addLayer({
          id: 'venue-cluster-count',
          type: 'symbol',
          source: 'venues',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-size': 13,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          },
          paint: { 'text-color': '#ffffff' },
        });

        // Individual dots (unclustered)
        currentMap.addLayer({
          id: 'venue-dots',
          type: 'circle',
          source: 'venues',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': 6,
            'circle-color': '#ff451b',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        // Click cluster → zoom in
        currentMap.on('click', 'venue-clusters', (e) => {
          const features = currentMap.queryRenderedFeatures(e.point, { layers: ['venue-clusters'] });
          const clusterId = features[0]?.properties?.cluster_id;
          if (clusterId == null) return;
          (currentMap.getSource('venues') as maplibregl.GeoJSONSource)
            .getClusterExpansionZoom(clusterId)
            .then(zoom => {
              currentMap.easeTo({
                center: (features[0].geometry as any).coordinates,
                zoom,
              });
            })
            .catch(() => {});
        });

        currentMap.on('mouseenter', 'venue-clusters', () => {
          currentMap.getCanvas().style.cursor = 'pointer';
        });
        currentMap.on('mouseleave', 'venue-clusters', () => {
          currentMap.getCanvas().style.cursor = '';
        });

        const hoverPopup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: false,
          maxWidth: '320px',
        });

        let popupTimeout: ReturnType<typeof setTimeout>;
        // Client-side enrichment cache keyed by "name|lat|lng"
        const enrichCache: Record<string, Record<string, any>> = {};
        let currentPopupMerged: Record<string, any> = {};
        let currentPopupCoords: [number, number] = [0, 0];

        function buildPopupHtml(props: Record<string, any>, loading = false): string {
          const ps = (window as any).__popupStrings || {};
          const str = {
            loadingDetails: ps.loadingDetails || 'Loading details...',
            loadMissingInfo: ps.loadMissingInfo || 'Load missing info',
            generateDescription: ps.generateDescription || '✨ Generate Description',
            generating: ps.generating || 'Generating...',
            viewAndWriteReviews: ps.viewAndWriteReviews || 'View & Write Reviews',
          };

          const type = props.cuisine
            ? `${props.amenity || 'Unknown'} • ${props.cuisine.replace(/_/g, ' ')}`
            : (props.amenity || 'Unknown Type');
          const address = props['addr:street']
            ? `${props['addr:street']} ${props['addr:housenumber'] || ''}`.trim()
            : null;
          const hasMissing = !props.phone || !props.website || !props.opening_hours || !props['addr:street'];
          const venueName = (props.name || 'Unknown Venue').replace(/'/g, "\\'");

          let html = `<div style="font-family: inherit; display: flex; flex-direction: column; gap: 4px; padding: 2px; min-width: 200px;">`;
          html += `<strong style="font-size: 14px;">${props.name || 'Unknown Venue'}</strong>`;
          html += `<div style="font-size: 12px; color: #666; text-transform: capitalize;">${type}</div>`;

          if (address) {
            html += `<div style="font-size: 12px;">📍 ${address}</div>`;
          }
          if (props.opening_hours) {
            html += `<div style="font-size: 12px;">🕐 ${props.opening_hours}</div>`;
          }
          if (props.phone) {
            html += `<div style="font-size: 12px;">📞 ${props.phone}</div>`;
          }
          if (props.website) {
            const href = props.website.startsWith('http') ? props.website : 'https://' + props.website;
            html += `<div style="font-size: 12px;"><a href="${href}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6;">🌐 Website</a></div>`;
          }
          if (props['brand:wikipedia']) {
            const wikiHref = `https://${props['brand:wikipedia'].replace(':', '.wikipedia.org/wiki/')}`;
            html += `<div style="font-size: 12px;"><a href="${wikiHref}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6;">📖 Wikipedia</a></div>`;
          }

          if (hasMissing) {
            if (loading) {
              html += `<div style="font-size: 11px; color: #888; margin-top: 4px;">${str.loadingDetails}</div>`;
            } else {
              const [lng, lat] = currentPopupCoords;
              html += `<div style="margin-top: 4px;"><button onclick="window.loadVenueDetails('${venueName}',${lat},${lng})" style="background: none; border: 1px solid #ccc; border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer; color: #555;">${str.loadMissingInfo}</button></div>`;
            }
          }

          if (props._aiDesc) {
            html += `<div style="font-size: 12px; color: #fff; margin-top: 4px; font-style: italic; border-left: 2px solid #a855f7; padding-left: 6px;">${props._aiDesc}</div>`;
          } else {
            const cuisine = (props.cuisine || '').replace(/'/g, "\\'");
            const amenity = (props.amenity || '').replace(/'/g, "\\'");
            const addrStreet = (props['addr:street'] || '').replace(/'/g, "\\'");
            const hours = (props.opening_hours || '').replace(/'/g, "\\'");
            html += `<div style="margin-top: 6px;"><button class="venue-ai-gen-btn" onclick="window.generateVenueDescription('${venueName}','${amenity}','${cuisine}','${addrStreet}','${hours}')" style="display: inline-block; background: none; border: 1px solid #a855f7; color: #a855f7; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; width: 100%;">${str.generateDescription}</button></div>`;
          }
          html += `<div style="margin-top: 6px;"><button onclick="window.openReviewModal('${venueName}')" style="display: inline-block; background-color: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%;">${str.viewAndWriteReviews}</button></div>`;
          html += `</div>`;
          return html;
        }

        window.generateVenueDescription = async (name: string, amenity: string, cuisine: string, address: string, opening_hours: string) => {
          const btn = document.querySelector<HTMLButtonElement>('.venue-ai-gen-btn');
          const lang = (window as any).__appLang || 'en';
          if (btn) { btn.textContent = lang === 'tr' ? 'Oluşturuluyor...' : 'Generating...'; btn.disabled = true; }
          try {
            const res = await fetch('http://localhost:3000/venues/describe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, amenity, cuisine, address, opening_hours, lang }),
            });
            const data = await res.json();
            if (data.description) {
              currentPopupMerged._aiDesc = data.description;
              hoverPopup.setHTML(buildPopupHtml(currentPopupMerged));
            } else {
              console.error('Describe error:', data.detail || data.error);
              if (btn) { btn.textContent = '❌ ' + (data.detail || 'Error'); btn.disabled = false; }
            }
          } catch (err) {
            console.error('Describe fetch error:', err);
            if (btn) { btn.textContent = '✨ Generate Description'; btn.disabled = false; }
          }
        };

        window.loadVenueDetails = async (name: string, lat: number, lng: number) => {
          const key = `${name}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
          if (key in enrichCache) return;

          // Show loading state
          hoverPopup.setHTML(buildPopupHtml(currentPopupMerged, true));

          try {
            const res = await fetch(`http://localhost:3000/venues/enrich?name=${encodeURIComponent(name)}&lat=${lat}&lng=${lng}`);
            const enriched = await res.json();
            enrichCache[key] = enriched;
            // Merge enriched into current props
            currentPopupMerged = { ...currentPopupMerged, ...enriched };
            hoverPopup.setHTML(buildPopupHtml(currentPopupMerged));
          } catch {
            enrichCache[key] = {};
            hoverPopup.setHTML(buildPopupHtml(currentPopupMerged));
          }
        };

        currentMap.on('mouseenter', 'venue-dots', () => {
          currentMap.getCanvas().style.cursor = 'pointer';
        });

        currentMap.on('mouseleave', 'venue-dots', () => {
          currentMap.getCanvas().style.cursor = '';
        });

        // Hide popup when cursor leaves map canvas entirely
        currentMap.getCanvas().addEventListener('mouseleave', () => {
          popupTimeout = setTimeout(() => hoverPopup.remove(), 300);
        });

        function showVenuePopup(feature: maplibregl.MapGeoJSONFeature, lngLat: maplibregl.LngLat) {
          const props = feature.properties as Record<string, any>;
          const coordinates = (feature.geometry as any).coordinates as [number, number];
          currentPopupCoords = coordinates;

          const key = `${props.name}|${coordinates[1].toFixed(4)}|${coordinates[0].toFixed(4)}`;
          const cached = enrichCache[key] ?? {};
          currentPopupMerged = { ...props, ...cached };

          clearTimeout(popupTimeout);
          // Use cursor lngLat (not geometry coords) so popup renders above terrain surface
          hoverPopup
            .setLngLat(lngLat)
            .setHTML(buildPopupHtml(currentPopupMerged))
            .addTo(currentMap);

          const popupEl = hoverPopup.getElement();
          if (popupEl) {
            popupEl.addEventListener('mouseenter', () => clearTimeout(popupTimeout));
            popupEl.addEventListener('mouseleave', () => {
              popupTimeout = setTimeout(() => hoverPopup.remove(), 300);
            });
          }
        }

        // Layer-specific mousemove (works at low pitch)
        currentMap.on('mousemove', 'venue-dots', (e) => {
          const feature = e.features?.[0];
          if (feature) showVenuePopup(feature, e.lngLat);
        });

        // Fallback: general mousemove + queryRenderedFeatures (works at high pitch/terrain)
        currentMap.on('mousemove', (e) => {
          const features = currentMap.queryRenderedFeatures(e.point, { layers: ['venue-dots'] });
          if (features.length > 0) {
            showVenuePopup(features[0], e.lngLat);
          }
        });

        currentMap.on('click', 'venue-dots', (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          clearTimeout(popupTimeout);
          showVenuePopup(feature, e.lngLat);
        });
      } catch (error) {
        console.error('Error fetching or adding venues:', error);
        setVenueError(((window as any).__popupStrings?.couldNotLoadVenues) || 'Could not load venues. Is the server running on port 3000?');
      } finally {
        setIsLoadingMap(false);
      }
    });

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      currentMap.remove();
      map.current = null;
    };
  }, [API_KEY, lat, lng, zoom]);

  if (mapError) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: '100vh',
          background: '#111',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div>
          <h2>{t.mapCannotBeDisplayed}</h2>
          <p>{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`map-wrap ${selectedVenueForReview ? 'blur-sm transition-all duration-300' : 'transition-all duration-300'}`}>
        {isLoadingMap && (
          <div className="map-loading-overlay">
            <div className="loader" style={{width: '32px', height: '32px'}}></div>
            <div>{t.loadingMapVenues}</div>
          </div>
        )}
        <div ref={mapContainer} className="map" />

        {venueError && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: '#7f1d1d', color: '#fca5a5', padding: '8px 16px',
            borderRadius: 8, fontSize: 13, zIndex: 10, maxWidth: 360, textAlign: 'center',
          }}>
            {venueError}
          </div>
        )}

        <MissionPanel />

        {/* Faction ranking widget */}
        <div className="map-ranking-widget">
          <button
            className="map-ranking-toggle"
            onClick={() => setShowRanking(v => !v)}
            title="Faction Rankings"
          >
            🏆 {showRanking ? '▲' : '▼'}
          </button>
          {showRanking && (
            <div className="map-ranking-panel">
              <div className="map-ranking-title">{t.factionRankings}</div>
              {factionRanking.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', padding: '0.5rem 0' }}>{t.noDataYet}</div>
              ) : (
                factionRanking.map((f, i) => (
                  <div key={f.id} className="map-ranking-row">
                    <span className="map-ranking-pos">#{i + 1}</span>
                    <span className="map-ranking-dot" style={{ background: f.color }} />
                    <span className="map-ranking-name">{f.name}</span>
                    <span className="map-ranking-pts">{f.totalPoints.toLocaleString()} pts</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      {selectedVenueForReview && (
        <ReviewModal
          venueName={selectedVenueForReview}
          onClose={() => setSelectedVenueForReview(null)}
        />
      )}
    </>
  );
}
