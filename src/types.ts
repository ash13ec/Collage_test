export type ShapeKind = "circle" | "square" | "triangle" | "blob" | "star" | "hexagon";

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
  fillMode: FillMode;
  image: string;
  color: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  depth: number;
};
