export interface PhotobankImage {
  id: string;
  name: string;
  src: string;
}

const nameFromPath = (path: string) => {
  const base = path.split('/').pop() ?? 'photo';
  return base.replace(/\.(png|jpe?g|webp)$/i, '').replace(/\s+2$/, '') || 'Photo';
};

const modules = import.meta.glob<true, string, string>('./photobank/*.{png,jpg,jpeg}', { eager: true, query: '?url', import: 'default' });

export const PHOTO_BANK: PhotobankImage[] = Object.entries(modules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, src], i) => {
    const base = nameFromPath(path);
    return {
      id: `p-${i}-${base.replace(/[^a-z0-9]+/gi, '-').slice(0, 32)}`,
      name: base,
      src,
    };
  });
