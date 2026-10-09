import { useId, useMemo } from 'react';
import { kitArtSvg, kitArtUrl } from '../lib/art';
import { bikeSvg } from '../lib/bike';
import { CompareSlider } from './compare';
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

/** La moto com'è e la moto con la grafica del kit, sovrapposte: si trascina il taglio per confrontarle. */
export function BikeCompare({ product, number, name, base, finish, className, buttons }: {
  product: Pick<Product, 'slug' | 'art_colors'>;
  number?: string;
  name?: string;
  base?: string;
  finish?: string;
  className?: string;
  buttons?: boolean;
}) {
  const uid = 'bk' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const stock = useMemo(
    () => bikeSvg({ variant: 'stock', seedKey: product.slug, colors: product.art_colors, idPrefix: uid + 's' }),
    [product.slug, product.art_colors, uid],
  );
  const custom = useMemo(
    () => bikeSvg({ variant: 'custom', seedKey: product.slug, colors: product.art_colors, number, name, base, finish, idPrefix: uid + 'c' }),
    [product.slug, product.art_colors, uid, number, name, base, finish],
  );
  return (
    <CompareSlider
      className={className}
      buttons={buttons}
      before={<div dangerouslySetInnerHTML={{ __html: stock }} />}
      after={<div dangerouslySetInnerHTML={{ __html: custom }} />}
    />
  );
}
