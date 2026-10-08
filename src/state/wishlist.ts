import { api } from '../data';
import { useAuth } from './auth';
import { useQuery } from './useQuery';
import { useUi } from './ui';
import { navigate, usePath } from '../router';

/** Preferiti del cliente. Senza account il cuore porta all'accesso. */
export function useWishlist() {
  const { user } = useAuth();
  const { toast } = useUi();
  const path = usePath();
  const q = useQuery(() => (user ? api.listWishlist() : Promise.resolve([] as string[])), [user?.id]);
  const ids = q.data ?? [];
  return {
    ids,
    has: (id: string) => ids.includes(id),
    async toggle(id: string) {
      if (!user) {
        toast('Accedi per salvare i preferiti');
        navigate(`/accedi?next=${encodeURIComponent(path)}`);
        return;
      }
      try {
        await api.toggleWishlist(id);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Non riesco a salvare', 'error');
      }
    },
  };
}
