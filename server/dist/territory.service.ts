import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import * as h3 from 'h3-js';

@Injectable()
export class TerritoryService {
    constructor(private prisma: PrismaService) { }

    /**
     * Converts a coordinate to an H3 Index (Resolution 9)
     */
    getHexIndex(lat: number, lng: number): string {
        return h3.latLngToCell(lat, lng, 9);
    }

    /**
     * Calculates the owning faction for an array of H3 Indexes.
     * Uses a CTE (Common Table Expression) and Window Functions to find the faction 
     * with the highest visit count per hexagon in a single fast query.
     */
    async getGridOwnership(hexIds: string[]) {
        if (!hexIds || hexIds.length === 0) return [];

        // Using Prisma.join to safely pass an array of strings to the raw SQL
        const ownership = await this.prisma.$queryRaw`
      WITH RankedFactions AS (
        SELECT 
          v."h3Index", 
          u."factionId", 
          COUNT(vis.id)::int as "visitCount",
          ROW_NUMBER() OVER(PARTITION BY v."h3Index" ORDER BY COUNT(vis.id) DESC) as rank
        FROM "Venue" v
        JOIN "Visit" vis ON v.id = vis."venueId"
        JOIN "User" u ON vis."userId" = u."id"
        WHERE v."h3Index" IN (${Prisma.join(hexIds)})
        GROUP BY v."h3Index", u."factionId"
      )
      SELECT "h3Index", "factionId", "visitCount"
      FROM RankedFactions
      WHERE rank = 1; -- Only get the winning faction per hex
    `;

        return ownership;
    }
}