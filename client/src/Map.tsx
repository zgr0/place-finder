import { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map.css';

export default function Map() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const lng = 29.0267;
  const lat = 40.9882;
  const zoom = 14;
  const API_KEY = import.meta.env.VITE_MAPTILER_KEY;

  useEffect(() => {
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
        });

        currentMap.addLayer({
          id: 'venue-dots',
          type: 'circle',
          source: 'venues',
          paint: {
            'circle-radius': 6,
            'circle-color': '#ff451b',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        const hoverPopup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
        });

        currentMap.on('mouseenter', 'venue-dots', () => {
          currentMap.getCanvas().style.cursor = 'pointer';
        });

        currentMap.on('mouseleave', 'venue-dots', () => {
          currentMap.getCanvas().style.cursor = '';
          hoverPopup.remove();
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
          html += `<div style="font-size: 12px; color: ${props.website ? '#0066cc' : '#999'};">${websiteText}</div>`;
          html += `</div>`;

          hoverPopup
            .setLngLat(coordinates)
            .setHTML(html)
            .addTo(currentMap);
        });

        currentMap.on('click', 'venue-dots', (e) => {
          const feature = e.features?.[0];
          if (!feature) return;

          const props = feature.properties as Record<string, any>;
          const coordinates = (feature.geometry as any).coordinates;

          let clickHtml = `<div style="font-family: inherit; padding: 4px; display: flex; flex-direction: column; gap: 6px;">`;
          clickHtml += `<strong style="font-size: 14px;">${props.name || 'Unknown Venue'}</strong>`;
          
          if (props.website) {
            clickHtml += `<div style="font-size: 13px;"><a href="${props.website.startsWith('http') ? props.website : 'https://' + props.website}" target="_blank" rel="noopener noreferrer">Visit Website</a></div>`;
          } else {
            clickHtml += `<div style="font-size: 13px; color: #999;">No website</div>`;
          }

          if (props['brand:wikipedia']) {
            clickHtml += `<div style="font-size: 13px;"><a href="https://${props['brand:wikipedia'].replace(':', '.wikipedia.org/wiki/')}" target="_blank" rel="noopener noreferrer">Wikipedia Info</a></div>`;
          } else {
            clickHtml += `<div style="font-size: 13px; color: #999;">No Wiki info</div>`;
          }
          clickHtml += `</div>`;

          new maplibregl.Popup()
            .setLngLat(coordinates)
            .setHTML(clickHtml)
            .addTo(currentMap);
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
    <div className="map-wrap">
      {isLoadingMap && (
        <div className="map-loading-overlay">
          <div className="loader" style={{width: '32px', height: '32px'}}></div>
          <div>Loading Map & Venues...</div>
        </div>
      )}
      <div ref={mapContainer} className="map" />
    </div>
  );
}
