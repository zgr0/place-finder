"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("./parser");
const fs = __importStar(require("fs"));
// Mock the 'fs' module
jest.mock('fs');
describe('Parser Utilities', () => {
    const mockGeoJson = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                properties: { name: 'Test Cafe', amenity: 'cafe' },
                geometry: { type: 'Point', coordinates: [35, 40] }
            },
            {
                type: 'Feature',
                properties: {},
                geometry: { type: 'Point', coordinates: [36, 41] }
            }
        ]
    };
    beforeEach(() => {
        jest.resetAllMocks();
    });
    describe('parseCafeGeoJson', () => {
        it('should parse the geojson file correctly when file exists', () => {
            // Mock existsSync to return true
            fs.existsSync.mockReturnValue(true);
            // Mock readFileSync to return stringified mockGeoJson
            fs.readFileSync.mockReturnValue(JSON.stringify(mockGeoJson));
            const result = (0, parser_1.parseCafeGeoJson)();
            expect(result).toEqual(mockGeoJson);
            expect(fs.readFileSync).toHaveBeenCalled();
        });
        it('should throw an error if read fails or invalid JSON', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation(() => {
                throw new Error('File read error');
            });
            expect(() => (0, parser_1.parseCafeGeoJson)()).toThrow('File read error');
        });
    });
    describe('getCafes', () => {
        it('should return the features array from the parsed geojson', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(mockGeoJson));
            const result = (0, parser_1.getCafes)();
            expect(result).toEqual(mockGeoJson.features);
        });
    });
    describe('getCafeInfo', () => {
        it('should map cafes to CafeInfo objects correctly, handling missing properties', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(mockGeoJson));
            const result = (0, parser_1.getCafeInfo)();
            // First feature has name and amenity
            expect(result[0]).toEqual({
                name: 'Test Cafe',
                type: 'cafe',
                coordinates: [35, 40]
            });
            // Second feature is missing name and amenity
            expect(result[1]).toEqual({
                name: 'Unknown',
                type: 'Unknown',
                coordinates: [36, 41]
            });
        });
    });
});
//# sourceMappingURL=parser.test.js.map