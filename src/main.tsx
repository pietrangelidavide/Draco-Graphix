import { createRoot } from 'react-dom/client';
import { App } from './App';
import { UiProvider } from './state/ui';
import { AuthProvider } from './state/auth';
import { CatalogProvider } from './state/catalog';
import { CartProvider } from './state/cart';
import './styles/tokens.css';
import './styles/brand.css';
import './styles/compare.css';
import './styles/base.css';
import './styles/components.css';
import './styles/shop.css';
import './styles/account.css';
import './styles/admin.css';

createRoot(document.getElementById('root')!).render(
  <UiProvider>
    <AuthProvider>
      <CatalogProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </CatalogProvider>
    </AuthProvider>
  </UiProvider>,
);
