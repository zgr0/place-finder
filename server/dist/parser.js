"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCafeGeoJson = parseCafeGeoJson;
exports.getCafes = getCafes;
exports.getCafeInfo = getCafeInfo;
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * cafe.geojson dosyasını ayrıştırır ve GeoJSON verilerini döndürür
 * @returns Ayrıştırılmış GeoJSON FeatureCollection öğesi
 */
function parseCafeGeoJson() {
    try {
        // Derlenmiş dosyanın dizinini (dist klasörü) almak için __dirname kullan
        // Ardından yukarı çıkıp cafe.geojson'un bulunduğu src klasörüne gezin
        let filePath = (0, path_1.join)(__dirname, 'src', 'cafe.geojson');
        if (!require('fs').existsSync(filePath)) {
            filePath = (0, path_1.join)(__dirname, '..', 'src', 'cafe.geojson');
        }
        const data = (0, fs_1.readFileSync)(filePath, 'utf-8');
        const geoJson = JSON.parse(data);
        return geoJson; // FeatureCollection'ı döndür
    }
    catch (error) {
        console.error('Error parsing cafe.geojson:', error);
        throw error;
    }
}
/**
 * Örnek kullanım: Tüm kafe özelliklerini al
 */
function getCafes() {
    const geoJson = parseCafeGeoJson();
    return geoJson.features;
}
/**
 * Yalnızca ad, tür ve koordinatları içeren basitleştirilmiş kafe bilgisini al
 */
function getCafeInfo() {
    const cafes = getCafes();
    return cafes.map(cafe => ({
        name: cafe.properties.name || 'Unknown',
        type: cafe.properties.amenity || 'Unknown',
        coordinates: cafe.geometry.coordinates
    }));
}
//console.log(getCafeInfo());
//# sourceMappingURL=parser.js.map