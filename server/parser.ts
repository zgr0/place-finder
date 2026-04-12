import { readFileSync } from 'fs';
import { join } from 'path';

// GeoJSON yapısı için türleri tanımla
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
 * cafe.geojson dosyasını ayrıştırır ve GeoJSON verilerini döndürür
 * @returns Ayrıştırılmış GeoJSON FeatureCollection öğesi
 */
export function parseCafeGeoJson(): GeoJsonFeatureCollection {
  try {
    // Derlenmiş dosyanın dizinini (dist klasörü) almak için __dirname kullan
    // Ardından yukarı çıkıp cafe.geojson'un bulunduğu src klasörüne gezin
    let filePath = join(__dirname, 'src', 'cafe.geojson');
    if (!require('fs').existsSync(filePath)) {
      filePath = join(__dirname, '..', 'src', 'cafe.geojson');
    }
    const data = readFileSync(filePath, 'utf-8');
    const geoJson: GeoJsonFeatureCollection = JSON.parse(data);
    return geoJson; // FeatureCollection'ı döndür
  } catch (error) {
    console.error('Error parsing cafe.geojson:', error);
    throw error;
  }
}

/**
 * Örnek kullanım: Tüm kafe özelliklerini al
 */
export function getCafes(): GeoJsonFeature[] {
  const geoJson = parseCafeGeoJson();
  return geoJson.features;
}

/**
 * Yalnızca ad, tür ve koordinatları içeren basitleştirilmiş kafe bilgisini al
 */
export function getCafeInfo(): CafeInfo[] {
  const cafes = getCafes();
  return cafes.map(cafe => ({
    name: cafe.properties.name || 'Unknown',
    type: cafe.properties.amenity || 'Unknown',
    coordinates: cafe.geometry.coordinates
  }));
}

//console.log(getCafeInfo());