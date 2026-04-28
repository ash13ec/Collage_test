import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { CollageLayer, ShapeKind } from './types';

type ThreeCollagePreviewProps = {
  layers: CollageLayer[];
  selectedLayerId: string;
  width: number;
  height: number;
};

const SHAPE_SEGMENTS = 96;

const createShape = (kind: ShapeKind) => {
  const shape = new THREE.Shape();

  if (kind === 'circle') {
    shape.absarc(0, 0, 1, 0, Math.PI * 2, false);
    return shape;
  }

  if (kind === 'star') {
    const points = 10;
    for (let i = 0; i <= points; i += 1) {
      const angle = (i / points) * Math.PI * 2 - Math.PI / 2;
      const radius = i % 2 === 0 ? 1 : 0.46;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    shape.closePath();
    return shape;
  }

  if (kind === 'triangle') {
    shape.moveTo(0, 1);
    shape.lineTo(0.95, -0.75);
    shape.lineTo(-0.95, -0.75);
    shape.closePath();
    return shape;
  }

  if (kind === 'hexagon') {
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    shape.closePath();
    return shape;
  }

  if (kind === 'blob') {
    shape.moveTo(-0.8, -0.35);
    shape.bezierCurveTo(-1.05, -0.9, -0.35, -1.05, 0.1, -0.82);
    shape.bezierCurveTo(0.75, -1.15, 1.15, -0.35, 0.82, 0.18);
    shape.bezierCurveTo(1.22, 0.72, 0.42, 1.12, -0.18, 0.88);
    shape.bezierCurveTo(-0.78, 1.12, -1.2, 0.32, -0.8, -0.35);
    shape.closePath();
    return shape;
  }

  shape.moveTo(-1, -1);
  shape.lineTo(1, -1);
  shape.lineTo(1, 1);
  shape.lineTo(-1, 1);
  shape.closePath();
  return shape;
};

const textureCache = new Map<string, THREE.Texture>();

const getTexture = (src: string) => {
  const cached = textureCache.get(src);
  if (cached) return cached;

  const texture = new THREE.TextureLoader().load(src);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  textureCache.set(src, texture);
  return texture;
};

export function ThreeCollagePreview({
  layers,
  selectedLayerId,
  width,
  height,
}: ThreeCollagePreviewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const orderedLayers = useMemo(() => [...layers].sort((a, b) => a.depth - b.depth), [layers]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f6efe4');

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      36,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0, 8);

    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(width / 140, height / 140),
      new THREE.MeshStandardMaterial({
        color: '#fbf7ef',
        roughness: 0.82,
        metalness: 0,
      }),
    );
    board.position.z = -0.08;
    scene.add(board);

    const boardShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(width / 132, height / 132),
      new THREE.MeshBasicMaterial({ color: '#ded2bf' }),
    );
    boardShadow.position.set(0.08, -0.08, -0.18);
    scene.add(boardShadow);

    scene.add(new THREE.AmbientLight('#ffffff', 2.1));
    const light = new THREE.DirectionalLight('#fff8ed', 2.2);
    light.position.set(-2, 4, 6);
    scene.add(light);

    const group = new THREE.Group();
    scene.add(group);

    const boardWidth = width / 140;
    const boardHeight = height / 140;

    orderedLayers.forEach((layer, index) => {
      const geometry = new THREE.ShapeGeometry(createShape(layer.shape), SHAPE_SEGMENTS);
      const material = new THREE.MeshStandardMaterial({
        color: layer.fillMode === 'color' ? layer.color : '#ffffff',
        map: layer.fillMode === 'photo' ? getTexture(layer.image) : null,
        roughness: 0.55,
        metalness: 0,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      const x = (layer.x / 2.4) * (boardWidth / 2.4);
      const y = (layer.y / 1.6) * (boardHeight / 2.35);
      mesh.position.set(x, y, index * 0.16);
      mesh.rotation.z = THREE.MathUtils.degToRad(layer.rotation);
      mesh.scale.setScalar(layer.scale * 0.72);
      group.add(mesh);

      const border = new THREE.LineLoop(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({
          color: layer.id === selectedLayerId ? '#111827' : '#ffffff',
          linewidth: 2,
        }),
      );
      border.position.copy(mesh.position);
      border.position.z += 0.01;
      border.rotation.copy(mesh.rotation);
      border.scale.copy(mesh.scale);
      group.add(border);
    });

    let frameId = 0;
    const render = () => {
      frameId = window.requestAnimationFrame(render);
      group.rotation.x = THREE.MathUtils.degToRad(-7);
      group.rotation.y = THREE.MathUtils.degToRad(12);
      renderer.render(scene, camera);
    };

    const handleResize = () => {
      const nextWidth = mount.clientWidth;
      const nextHeight = mount.clientHeight;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    };

    window.addEventListener('resize', handleResize);
    render();

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      mount.removeChild(renderer.domElement);
      group.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineLoop) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else {
            material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, [height, orderedLayers, selectedLayerId, width]);

  return <div className="three-preview" ref={mountRef} aria-label="3D collage layer preview" />;
}
