import { cellToBoundary, polygonToCells } from 'h3-js';

const hexId = '891f1d4881fffff';
const boundary = cellToBoundary(hexId, true);
console.log('Boundary with true:', boundary);

const boundaryFalse = cellToBoundary(hexId);
console.log('Boundary without true:', boundaryFalse);

const bounds = {
    getSouth: () => 40.9,
    getNorth: () => 41.0,
    getWest: () => 29.0,
    getEast: () => 29.1,
};

const polygon = [
    [bounds.getSouth(), bounds.getWest()],
    [bounds.getNorth(), bounds.getWest()],
    [bounds.getNorth(), bounds.getEast()],
    [bounds.getSouth(), bounds.getEast()],
    [bounds.getSouth(), bounds.getWest()],
];

const cells = polygonToCells(polygon, 9);
console.log('Cells:', cells.slice(0, 3));
