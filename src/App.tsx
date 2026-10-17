import { useState } from 'react';

import { CartDrawer, CheckoutDialog } from '@/components/cart';
import { useCart } from '@/hooks/useCart';
import useApiKeyInit from '@/hooks/useApiKeyInit';
import { useSimulationShopContext } from '@/hooks/useSimulationShopContext';
import { useTheme } from '@/hooks/useTheme';
import Hero from './components/Hero';
import Navbar from './components/Navbar';
import type { Page } from './components/Navbar';
import { isSessionCode, parseJoinPath, parseRole } from '@/types/simulationRoles';
import SimulationPage from './pages/SimulationPage';
import WebshopPage from './pages/WebshopPage';

/** Reads `?session=…&role=…` from a scanned QR code so students land directly on their role. */
function readJoinTarget() {
  // `/join/<code>`: the single join link for everybody (name + role are picked on the page).
  const joinPathCode = parseJoinPath(window.location.pathname);
  if (joinPathCode) return { sessionId: joinPathCode, role: null };
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session');
  return sessionId && isSessionCode(sessionId)
    ? { sessionId, role: parseRole(params.get('role')) }
    : null;
}

function App() {
  const [joinTarget, setJoinTarget] = useState(readJoinTarget);
  // A QR/deep-link start is a simulation entry: it must not request the ERP key. Remembered once,
  // because `joinTarget` is cleared on navigation and the decision must not flip back then.
  // (Shop pages still get a key on demand: authenticated requests await `ensureApiKey`.)
  const [isSimulationEntry] = useState(() => joinTarget !== null);
  const { simulationSessionId, simulationCustomerName, enterSimulation, leaveSimulation } =
    useSimulationShopContext();
  // Customer links and `mode=simulation` (shop context) skip the key as well.
  useApiKeyInit(!isSimulationEntry && simulationSessionId === null);
  const { theme, toggleTheme } = useTheme();
  const [currentPage, setCurrentPage] = useState<Page>(joinTarget ? 'simulation' : 'home');
  const [productsRefreshKey, setProductsRefreshKey] = useState(0);
  const {
    cartItems,
    isCartOpen,
    isCheckoutOpen,
    cartCount,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    openCart,
    closeCart,
    openCheckout,
    closeCheckout,
  } = useCart();

  function handleNavigate(page: Page) {
    // Leaving the page ends a QR join flow; coming back shows the dashboard.
    setJoinTarget(null);
    setCurrentPage(page);
  }

  function handleLeaveSimulation() {
    // Simulation article ids (1–6) would collide with ERP articles, so the cart must not survive.
    clearCart();
    leaveSimulation();
  }

  function handleOrderPlaced() {
    clearCart();
    // Ordered stock is now reserved — reload so the shop shows the reduced availability.
    setProductsRefreshKey((previousKey) => previousKey + 1);
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <Navbar
        cartCount={cartCount}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onOpenCart={openCart}
        onToggleTheme={toggleTheme}
        theme={theme}
      />
      {currentPage === 'home' && <Hero onNavigate={handleNavigate} />}
      {currentPage === 'webshop' && (
        <WebshopPage
          cartItems={cartItems}
          onAddToCart={addToCart}
          onLeaveSimulation={handleLeaveSimulation}
          refreshKey={productsRefreshKey}
          simulationSessionId={simulationSessionId}
        />
      )}
      {currentPage === 'simulation' && (
        <SimulationPage
          joinTarget={joinTarget}
          onEnterSimulationShop={enterSimulation}
          onNavigate={handleNavigate}
        />
      )}
      <CartDrawer
        cartCount={cartCount}
        isOpen={isCartOpen}
        isSimulation={simulationSessionId !== null}
        items={cartItems}
        onClearCart={clearCart}
        onClose={closeCart}
        onOpenCheckout={openCheckout}
        onRemove={removeFromCart}
        onUpdateQuantity={updateQuantity}
      />
      <CheckoutDialog
        isOpen={isCheckoutOpen}
        items={cartItems}
        onClose={closeCheckout}
        onOrderPlaced={handleOrderPlaced}
        onRemove={removeFromCart}
        onUpdateQuantity={updateQuantity}
        initialCustomerName={simulationCustomerName}
        simulationSessionId={simulationSessionId}
      />
    </div>
  );
}

export default App;
