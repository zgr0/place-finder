import { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map.css';
import ReviewModal from './Review';

declare global {
  interface Window {
    openReviewModal: (venueName: string) => void;
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
  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const [selectedVenueForReview, setSelectedVenueForReview] = useState<string | null>(null);
  const [factionRanking, setFactionRanking] = useState<FactionRank[]>([]);
  const [showRanking, setShowRanking] = useState(false);

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
      canvasContextAttributes: {
        antialias: false,
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: false,
      },
    });

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

    currentMap.on('error', (error) => {
      console.error('MapLibre error event:', error);
      setMapError('MapLibre failed to initialize. Check browser console for details.');
    });

    currentMap.on('load', async () => {
      try {
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
          (currentMap.getSource('venues') as maplibregl.GeoJSONSource).getClusterExpansionZoom(
            clusterId,
            (err, zoom) => {
              if (err) return;
              currentMap.easeTo({
                center: (features[0].geometry as any).coordinates,
                zoom: zoom!,
              });
            }
          );
        });

        currentMap.on('mouseenter', 'venue-clusters', () => {
          currentMap.getCanvas().style.cursor = 'pointer';
        });
        currentMap.on('mouseleave', 'venue-clusters', () => {
          currentMap.getCanvas().style.cursor = '';
        });

        const hoverPopup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
        });

        let popupTimeout: ReturnType<typeof setTimeout>;

        currentMap.on('mouseenter', 'venue-dots', () => {
          currentMap.getCanvas().style.cursor = 'pointer';
        });

        currentMap.on('mouseleave', 'venue-dots', () => {
          currentMap.getCanvas().style.cursor = '';
          popupTimeout = setTimeout(() => {
            hoverPopup.remove();
          }, 300);
        });

        currentMap.on('mousemove', 'venue-dots', (e) => {
          const feature = e.features?.[0];
          if (!feature) return;

          const props = feature.properties as Record<string, any>;
          const coordinates = (feature.geometry as any).coordinates;

          const type = props.cuisine ? `${props.amenity || 'Unknown'} • ${props.cuisine.replace(/_/g, ' ')}` : (props.amenity || 'Unknown Type');
          const address = props['addr:street'] ? `${props['addr:street']} ${props['addr:housenumber'] || ''}`.trim() : 'Address not available';
          const hours = props.opening_hours || 'Hours not available';
          const phone = props.phone || 'Phone not available';
          const websiteText = props.website ? 'Website available (click)' : 'No website available';
          
          let html = `<div style="font-family: inherit; display: flex; flex-direction: column; gap: 4px; padding: 2px;">`;
          html += `<strong style="font-size: 14px;">${props.name || 'Unknown Venue'}</strong>`;
          html += `<div style="font-size: 12px; color: #666; text-transform: capitalize;">${type}</div>`;
          html += `<div style="font-size: 12px;">${address}</div>`;
          html += `<div style="font-size: 12px;">${hours}</div>`;
          html += `<div style="font-size: 12px;">${phone}</div>`;
          if (props.website) {
            html += `<div style="font-size: 12px;"><a href="${props.website.startsWith('http') ? props.website : 'https://' + props.website}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6;">Visit Website</a></div>`;
          } else {
            html += `<div style="font-size: 12px; color: #999;">No website</div>`;
          }

          if (props['brand:wikipedia']) {
            html += `<div style="font-size: 12px;"><a href="https://${props['brand:wikipedia'].replace(':', '.wikipedia.org/wiki/')}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6;">Wikipedia Info</a></div>`;
          } else {
            html += `<div style="font-size: 12px; color: #999;">No Wiki info</div>`;
          }
          
          html += `<div style="margin-top: 12px; text-align: center;"><button onclick="window.openReviewModal('${(props.name || 'Unknown Venue').replace(/'/g, "\\'")}')" style="display: inline-block; background-color: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%; transition: background-color 0.2s;">View & Write Reviews</button></div>`;
          html += `</div>`;

          clearTimeout(popupTimeout);
          hoverPopup
            .setLngLat(coordinates)
            .setHTML(html)
            .addTo(currentMap);
            
          const popupEl = hoverPopup.getElement();
          if (popupEl) {
            popupEl.addEventListener('mouseenter', () => {
              clearTimeout(popupTimeout);
            });
            popupEl.addEventListener('mouseleave', () => {
              popupTimeout = setTimeout(() => {
                hoverPopup.remove();
              }, 300);
            });
          }
        });
      } catch (error) {
        console.error('Error fetching or adding venues:', error);
        setMapError('Failed to load venue data from the server.');
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
          <h2>Map cannot be displayed</h2>
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
            <div>Loading Map & Venues...</div>
          </div>
        )}
        <div ref={mapContainer} className="map" />

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
              <div className="map-ranking-title">Faction Rankings</div>
              {factionRanking.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', padding: '0.5rem 0' }}>No data yet</div>
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
