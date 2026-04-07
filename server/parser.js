"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCafeGeoJson = parseCafeGeoJson;
exports.getCafes = getCafes;
exports.getCafeInfo = getCafeInfo;
var fs_1 = require("fs");
var path_1 = require("path");
/**
 * Parses the cafe.geojson file and returns the GeoJSON data
 * @returns The parsed GeoJSON FeatureCollection
 */
function parseCafeGeoJson() {
    try {
        // Use __dirname to get the directory of the compiled file (dist folder)
        // Then navigate up and into src folder where cafe.geojson is located
        var filePath = (0, path_1.join)(__dirname, '..', 'src', 'cafe.geojson');
        var data = (0, fs_1.readFileSync)(filePath, 'utf-8');
        var geoJson = JSON.parse(data);
        return geoJson; // Return the FeatureCollection
    }
    catch (error) {
        console.error('Error parsing cafe.geojson:', error);
        throw error;
    }
}
/**
 * Example usage: Get all cafe features
 */
function getCafes() {
    var geoJson = parseCafeGeoJson();
    return geoJson.features;
}
/**
 * Get simplified cafe info with just name, type, and coordinates
 */
function getCafeInfo() {
    var cafes = getCafes();
    return cafes.map(function (cafe) { return ({
        name: cafe.properties.name || 'Unknown',
        type: cafe.properties.amenity || 'Unknown',
        coordinates: cafe.geometry.coordinates
    }); });
}
console.log(getCafeInfo());
