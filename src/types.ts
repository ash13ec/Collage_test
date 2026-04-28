import type { ShapeId } from "./shapeCatalog";

export type ShapeKind = ShapeId;

export type FillMode = "photo" | "color";

export type PhotoSource = {
  id: string;
  name: string;
  src: string;
  type: "photobank" | "upload";
};

export type CollageLayer = {
  id: string;
  name: string;
  shape: ShapeKind;
  /** If true, image shows outside the cutout; inside is clear (SVG / rectangle frame). */
  maskInverted: boolean;
  fillMode: FillMode;
  image: string;
  color: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  depth: number;
};
