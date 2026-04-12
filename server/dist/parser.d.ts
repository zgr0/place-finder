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
export declare function parseCafeGeoJson(): GeoJsonFeatureCollection;
/**
 * Example usage: Get all cafe features
 */
export declare function getCafes(): GeoJsonFeature[];
/**
 * Get simplified cafe info with just name, type, and coordinates
 */
export declare function getCafeInfo(): CafeInfo[];
export {};
//# sourceMappingURL=parser.d.ts.map