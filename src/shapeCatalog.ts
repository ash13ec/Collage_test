// SVGs from src/shape — Vite inlines as strings
import building2Svg from './shape/building 2.svg?raw';
import buildingSvg from './shape/building.svg?raw';
import grassSvg from './shape/grass.svg?raw';
import lightSvg from './shape/light.svg?raw';
import people2Svg from './shape/people 2.svg?raw';
import people3Svg from './shape/people 3.svg?raw';
import peopleSvg from './shape/people.svg?raw';

export type ShapeOption =
  | { id: 'rectangle'; label: string; type: 'rectangle' }
  | { id: string; label: string; type: 'mask'; svg: string };

/** Only rectangle (procedural) + SVG-based masks. */
export const SHAPE_OPTIONS: ShapeOption[] = [
  { id: 'rectangle', label: 'Rectangle', type: 'rectangle' },
  { id: 'mask-building', label: 'Building', type: 'mask', svg: buildingSvg },
  { id: 'mask-building-2', label: 'Building 2', type: 'mask', svg: building2Svg },
  { id: 'mask-grass', label: 'Grass', type: 'mask', svg: grassSvg },
  { id: 'mask-light', label: 'Light', type: 'mask', svg: lightSvg },
  { id: 'mask-people', label: 'People', type: 'mask', svg: peopleSvg },
  { id: 'mask-people-2', label: 'People 2', type: 'mask', svg: people2Svg },
  { id: 'mask-people-3', label: 'People 3', type: 'mask', svg: people3Svg },
];

export type ShapeId = (typeof SHAPE_OPTIONS)[number]['id'];

export const DEFAULT_SHAPE: ShapeId = 'rectangle';

export function getShapeDef(id: ShapeId | string): ShapeOption | undefined {
  return SHAPE_OPTIONS.find((o) => o.id === id);
}
