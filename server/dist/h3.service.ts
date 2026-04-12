import { Injectable } from '@nestjs/common';
import * as h3 from 'h3-js';

@Injectable()
export class H3Service {
    private readonly RESOLUTION = 9;

    // Convert Lat/Lng to a Hexagon ID
    getHexagonId(lat: number, lng: number): string {
        return h3.latLngToCell(lat, lng, this.RESOLUTION);
    }

    // Get the boundary coordinates of a hexagon (for the frontend)
    getHexagonBoundary(h3Index: string) {
        return h3.cellToBoundary(h3Index);
    }
}