import { useId, useMemo } from 'react';
import { kitArtSvg, kitArtUrl } from '../lib/art';
import type { Product } from '../lib/types';

/** Immagine di un prodotto: la foto caricata, oppure la tavola di stampa generata. */
export function KitArt({ product, className, eager }: { product: Pick<Product, 'slug' | 'name' | 'images' | 'art_colors'>; className?: string; eager?: boolean }) {
  const src = useMemo(() => product.images[0] ?? kitArtUrl(product.slug, product.art_colors), [product.images, product.slug, product.art_colors]);
  return <img className={`art ${className ?? ''}`} src={src} alt={product.name} loading={eager ? 'eager' : 'lazy'} decoding="async" />;
}

/** Anteprima viva: cambia mentre il cliente scrive numero e nome o sceglie base e laminazione. */
export function LiveArt({ product, number, name, base, finish, className }: {
  product: Pick<Product, 'slug' | 'art_colors'>;
  number?: string;
  name?: string;
  base?: string;
  finish?: string;
  className?: string;
}) {
  const prefix = 'la' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const svg = useMemo(
    () => kitArtSvg(product.slug, product.art_colors, { idPrefix: prefix, number, name, base, finish }),
    [product.slug, product.art_colors, prefix, number, name, base, finish],
  );
  return <div className={`art live-art ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
