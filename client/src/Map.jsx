import React, { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map.css';
export default function Map() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const lng = 139.753;
  const lat = 35.6844;
  const zoom = 14;
  const API_KEY = import.meta.env.VITE_MAPTILER_KEY;
  useEffect(() => {
    if (map.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets/style.json?key=${API_KEY}`,
      center: [lng, lat],
      zoom: zoom
    });
  }, [lng, lat, zoom, API_KEY]);
  return (
  <div className="map-wrap">
    <div ref={mapContainer} className="map" />
  </div>
);
}