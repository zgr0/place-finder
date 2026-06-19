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
export declare function parseCafeGeoJson(): GeoJsonFeatureCollection;
/**
 * Örnek kullanım: Tüm kafe özelliklerini al
 */
export declare function getCafes(): GeoJsonFeature[];
/**
 * Yalnızca ad, tür ve koordinatları içeren basitleştirilmiş kafe bilgisini al
 */
export declare function getCafeInfo(): CafeInfo[];
export {};
//# sourceMappingURL=parser.d.ts.map