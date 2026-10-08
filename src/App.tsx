import type { ReactNode } from 'react';
import { Router, usePath } from './router';
import type { RouteDef } from './router';
import { ShopShell } from './layouts/ShopShell';
import { AdminShell } from './layouts/AdminShell';
import { HomePage } from './pages/shop/Home';
import { CatalogPage } from './pages/shop/Catalog';
import { ProductPage } from './pages/shop/Product';
import { CartPage, CheckoutPage, OrderDonePage } from './pages/shop/Cart';
import { CustomPage } from './pages/shop/Custom';
import { ContactPage, TeamPage } from './pages/shop/Forms';
import { LegalPage, LoginPage, NotFoundPage, RegisterPage } from './pages/shop/Misc';
import { AccountLayout, OrderDetailPage, OrdersPage, OverviewPage, QuoteDetailPage, QuotesPage } from './pages/account/Account';
import { ProjectDetailPage, ProjectsPage } from './pages/account/Projects';
import { GaragePage, ProfilePage, WishlistPage } from './pages/account/Garage';
import { DashboardPage } from './pages/admin/Dashboard';
import { ProductionPage } from './pages/admin/Production';
import { AdminOrderDetailPage, AdminOrdersPage } from './pages/admin/Orders';
import { AdminProjectDetailPage, AdminProjectsPage } from './pages/admin/Projects';
import { AdminQuoteDetailPage, AdminQuotesPage } from './pages/admin/Quotes';
import { AdminCatalogPage, AdminProductEditPage } from './pages/admin/Catalog';
import { AdminCustomerDetailPage, AdminCustomersPage, AdminLeadsPage } from './pages/admin/People';
import { AdminSettingsPage } from './pages/admin/Settings';

const acc = (node: ReactNode) => <AccountLayout>{node}</AccountLayout>;

const shopRoutes: RouteDef[] = [
  { path: '/', render: () => <HomePage /> },
  { path: '/catalogo', render: () => <CatalogPage /> },
  { path: '/prodotto/:slug', render: (p) => <ProductPage slug={p.slug!} /> },
  { path: '/su-misura', render: () => <CustomPage /> },
  { path: '/team', render: () => <TeamPage /> },
  { path: '/contatti', render: () => <ContactPage /> },
  { path: '/carrello', render: () => <CartPage /> },
  { path: '/checkout', render: () => <CheckoutPage /> },
  { path: '/ordine-completato/:id', render: (p) => <OrderDonePage id={p.id!} /> },
  { path: '/privacy', render: () => <LegalPage kind="privacy" /> },
  { path: '/condizioni', render: () => <LegalPage kind="condizioni" /> },
  { path: '/accedi', render: () => <LoginPage /> },
  { path: '/registrati', render: () => <RegisterPage /> },
  { path: '/account', render: () => acc(<OverviewPage />) },
  { path: '/account/ordini', render: () => acc(<OrdersPage />) },
  { path: '/account/ordini/:id', render: (p) => acc(<OrderDetailPage id={p.id!} />) },
  { path: '/account/progetti', render: () => acc(<ProjectsPage />) },
  { path: '/account/progetti/:id', render: (p) => acc(<ProjectDetailPage id={p.id!} />) },
  { path: '/account/preventivi', render: () => acc(<QuotesPage />) },
  { path: '/account/preventivi/:id', render: (p) => acc(<QuoteDetailPage id={p.id!} />) },
  { path: '/account/garage', render: () => acc(<GaragePage />) },
  { path: '/account/preferiti', render: () => acc(<WishlistPage />) },
  { path: '/account/profilo', render: () => acc(<ProfilePage />) },
];

const adminRoutes: RouteDef[] = [
  { path: '/gestionale', render: () => <DashboardPage /> },
  { path: '/gestionale/ordini', render: () => <AdminOrdersPage /> },
  { path: '/gestionale/ordini/:id', render: (p) => <AdminOrderDetailPage id={p.id!} /> },
  { path: '/gestionale/produzione', render: () => <ProductionPage /> },
  { path: '/gestionale/progetti', render: () => <AdminProjectsPage /> },
  { path: '/gestionale/progetti/:id', render: (p) => <AdminProjectDetailPage id={p.id!} /> },
  { path: '/gestionale/preventivi', render: () => <AdminQuotesPage /> },
  { path: '/gestionale/preventivi/:id', render: (p) => <AdminQuoteDetailPage id={p.id!} /> },
  { path: '/gestionale/catalogo', render: () => <AdminCatalogPage /> },
  { path: '/gestionale/catalogo/:id', render: (p) => <AdminProductEditPage id={p.id!} /> },
  { path: '/gestionale/clienti', render: () => <AdminCustomersPage /> },
  { path: '/gestionale/clienti/:id', render: (p) => <AdminCustomerDetailPage id={p.id!} /> },
  { path: '/gestionale/contatti', render: () => <AdminLeadsPage /> },
  { path: '/gestionale/impostazioni', render: () => <AdminSettingsPage /> },
];

export function App() {
  const path = usePath();
  if (path === '/gestionale' || path.startsWith('/gestionale/')) {
    return (
      <AdminShell>
        <Router routes={adminRoutes} fallback={<NotFoundPage />} />
      </AdminShell>
    );
  }
  return (
    <ShopShell>
      <Router routes={shopRoutes} fallback={<NotFoundPage />} />
    </ShopShell>
  );
}
