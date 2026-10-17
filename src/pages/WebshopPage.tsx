import type { Article } from '@/api/articles/listArticlesApi';
import { ProductCard, SimulationBanner } from '@/components/webshop';
import { useWebshopProducts } from '@/hooks/useWebshopProducts';
import type { CartItem } from '@/types/cart';
import { SIMULATION_CATALOG } from '@/types/simulationCatalog';

type Props = Readonly<{
  onAddToCart: (article: Article) => void;
  cartItems: CartItem[];
  refreshKey: number;
  /** Set in simulation mode: the shop then shows the static catalogue and never calls the ERP. */
  simulationSessionId?: string | null;
  /** Simulation banner button: leave simulation mode and return to the ERP shop. */
  onLeaveSimulation?: () => void;
}>;

type ShopViewProps = Readonly<{
  articles: Article[];
  status: 'loading' | 'error' | 'success';
  errorMessage: string;
  onAddToCart: (article: Article) => void;
  cartItems: CartItem[];
  simulationSessionId: string | null;
  onLeaveSimulation: () => void;
}>;

function ShopView({
  articles,
  status,
  errorMessage,
  onAddToCart,
  cartItems,
  simulationSessionId,
  onLeaveSimulation,
}: ShopViewProps) {
  const quantityInCartById = new Map(
    cartItems.map((cartItem) => [cartItem.article.id, cartItem.quantity])
  );

  return (
    <main className="mx-auto w-full max-w-[90rem] px-xxl py-6 sm:py-8">
      {simulationSessionId && (
        <SimulationBanner onExit={onLeaveSimulation} sessionId={simulationSessionId} />
      )}
      <h1 className="mb-xxxl text-2xl font-bold text-ink">Webshop</h1>

      {status === 'loading' && (
        <div className="flex h-64 items-center justify-center text-ink-muted">
          Produkte werden geladen…
        </div>
      )}

      {status === 'error' && (
        <div className="flex h-64 items-center justify-center text-danger-ink">
          Fehler beim Laden: {errorMessage}
        </div>
      )}

      {status === 'success' && articles.length === 0 && (
        <div className="flex h-64 items-center justify-center text-ink-muted">
          Keine Produkte verfügbar.
        </div>
      )}

      {status === 'success' && articles.length > 0 && (
        <div className="grid grid-cols-1 gap-xxl sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {articles.map((article) => (
            <ProductCard
              article={article}
              key={article.id}
              onAddToCart={onAddToCart}
              isSimulation={simulationSessionId !== null}
              quantityInCart={quantityInCartById.get(article.id) ?? 0}
            />
          ))}
        </div>
      )}
    </main>
  );
}

/** ERP-backed shop: only mounted outside simulation mode, so no ERP request happens in the simulation. */
function ErpShop({
  refreshKey,
  ...rest
}: Omit<ShopViewProps, 'articles' | 'status' | 'errorMessage'> & { refreshKey: number }) {
  const { articles, status, errorMessage } = useWebshopProducts(refreshKey);
  return <ShopView {...rest} articles={articles} errorMessage={errorMessage} status={status} />;
}

function WebshopPage({
  onAddToCart,
  cartItems,
  refreshKey,
  simulationSessionId = null,
  onLeaveSimulation = () => {},
}: Props) {
  if (simulationSessionId !== null) {
    return (
      <ShopView
        articles={SIMULATION_CATALOG}
        cartItems={cartItems}
        errorMessage=""
        onAddToCart={onAddToCart}
        onLeaveSimulation={onLeaveSimulation}
        simulationSessionId={simulationSessionId}
        status="success"
      />
    );
  }
  return (
    <ErpShop
      cartItems={cartItems}
      onAddToCart={onAddToCart}
      onLeaveSimulation={onLeaveSimulation}
      refreshKey={refreshKey}
      simulationSessionId={null}
    />
  );
}

export default WebshopPage;
