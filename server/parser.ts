import { readFileSync } from 'fs';
import { join } from 'path';

// Define types for GeoJSON structure
interface GeoJsonFeature {
  type: 'Feature';
  properties: Record<string, any>;
  geometry: {
    type: string;
    coordinates: number[];
  };
  id?: string;
}

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
  generator?: string;
  copyright?: string;
  timestamp?: string;
}

interface CafeInfo {
  name: string;
  type: string;
  coordinates: number[];
}

/**
 * Parses the cafe.geojson file and returns the GeoJSON data
 * @returns The parsed GeoJSON FeatureCollection
 */
export function parseCafeGeoJson(): GeoJsonFeatureCollection {
  try {
    // Use __dirname to get the directory of the compiled file (dist folder)
    // Then navigate up and into src folder where cafe.geojson is located
    const filePath = join(__dirname, '..', 'src', 'cafe.geojson');
    const data = readFileSync(filePath, 'utf-8');
    const geoJson: GeoJsonFeatureCollection = JSON.parse(data);
    return geoJson; // Return the FeatureCollection
  } catch (error) {
    console.error('Error parsing cafe.geojson:', error);
    throw error;
  }
}

/**
 * Example usage: Get all cafe features
 */
export function getCafes(): GeoJsonFeature[] {
  const geoJson = parseCafeGeoJson();
  return geoJson.features;
}

/**
 * Get simplified cafe info with just name, type, and coordinates
 */
export function getCafeInfo(): CafeInfo[] {
  const cafes = getCafes();
  return cafes.map(cafe => ({
    name: cafe.properties.name || 'Unknown',
    type: cafe.properties.amenity || 'Unknown',
    coordinates: cafe.geometry.coordinates
  }));
}

console.log(getCafeInfo());