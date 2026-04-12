import { PrismaService } from '../prisma.service';
export declare class VenuesService {
    private prisma;
    constructor(prisma: PrismaService);
    getAllVenues(): Promise<{
        type: string;
        features: {
            type: string;
            geometry: {
                type: string;
                coordinates: any[];
            };
            properties: {
                id: any;
                name: any;
                category: any;
                h3: any;
            };
        }[];
    }>;
}
//# sourceMappingURL=venues.service.d.ts.map