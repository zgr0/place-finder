import { parseCafeGeoJson, getCafes, getCafeInfo } from './parser';
import * as fs from 'fs';
import { join } from 'path';

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
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      // Mock readFileSync to return stringified mockGeoJson
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockGeoJson));

      const result = parseCafeGeoJson();
      expect(result).toEqual(mockGeoJson);
      expect(fs.readFileSync).toHaveBeenCalled();
    });

    it('should throw an error if read fails or invalid JSON', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File read error');
      });

      expect(() => parseCafeGeoJson()).toThrow('File read error');
    });
  });

  describe('getCafes', () => {
    it('should return the features array from the parsed geojson', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockGeoJson));

      const result = getCafes();
      expect(result).toEqual(mockGeoJson.features);
    });
  });

  describe('getCafeInfo', () => {
    it('should map cafes to CafeInfo objects correctly, handling missing properties', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockGeoJson));

      const result = getCafeInfo();
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
