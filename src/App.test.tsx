import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';

import { API_KEY_STORAGE_KEY } from '@/hooks/useApiKeyInit';
import { jsonResponse } from '@/test/fixtures';

import App from './App';

type Handler = (init?: RequestInit) => Response | Promise<Response>;

const rawArticles = [
  { id: 1, name: 'Gehäuse rot', type: 'Gehäuse', price: 2, available_quantity: 3 },
  { id: 2, name: 'Deckel blau', type: 'Deckel', price: 1, available_quantity: 0 },
];

let handlers: Record<string, Handler>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.setItem(API_KEY_STORAGE_KEY, 'test-key');
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn() })
  );
  handlers = {
    '/article/list?sellableOnly=true': () => jsonResponse({ articles: rawArticles }),
    '/order/sale/create': () => jsonResponse({ id: 77 }),
  };
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const handler = handlers[path];
    return Promise.resolve(handler ? handler(init) : jsonResponse({}, 404));
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.className = '';
});

async function openWebshop() {
  await userEvent.click(screen.getByRole('button', { name: 'Webshop' }));
  await screen.findByText('Gehäuse rot');
}

describe('App', () => {
  it('starts on the landing page and navigates to the webshop and back', async () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Zum Webshop' })).toBeInTheDocument();
    await openWebshop();
    expect(screen.getByRole('heading', { name: 'Webshop' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: 'Zum Webshop' })).toBeInTheDocument();
  });

  it('sends the stored API key with article requests', async () => {
    render(<App />);
    await openWebshop();
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-key');
  });

  it('toggles the theme on the document', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Dark Mode aktivieren' }));
    expect(document.documentElement).toHaveClass('dark');
  });

  it('runs the full flow: add to cart, check out, reload stock', async () => {
    render(<App />);
    await openWebshop();

    await userEvent.click(screen.getAllByRole('button', { name: 'Warenkorb' })[0]);
    expect(screen.getByRole('button', { name: 'Warenkorb öffnen, 1 Artikel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nicht verfügbar' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Warenkorb öffnen, 1 Artikel' }));
    const drawer = screen.getByRole('complementary', { name: 'Warenkorb' });
    expect(within(drawer).getByText('€2.00', { selector: 'span' })).toBeInTheDocument();

    handlers['/article/list?sellableOnly=true'] = () =>
      jsonResponse({ articles: [{ ...rawArticles[0], available_quantity: 2 }] });

    await userEvent.click(within(drawer).getByRole('button', { name: 'Zur Kasse' }));
    await userEvent.click(screen.getByRole('button', { name: 'Kreditkarte' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bestellung Aufgeben' }));

    expect(await screen.findByText('#77')).toBeInTheDocument();
    const orderCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/order/sale/create')
    );
    expect(JSON.parse(orderCall![1].body)).toEqual({
      customer_id: 1,
      products: [{ productId: 1, quantity: 1 }],
    });

    // Cart is cleared and stock is refetched (3 → 2).
    expect(await screen.findByText('Lager: 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Warenkorb öffnen' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Weiter einkaufen' }));
    expect(screen.queryByText('Kasse')).not.toBeInTheDocument();
  });

  it('keeps the cart when the order fails', async () => {
    handlers['/order/sale/create'] = () => jsonResponse({ detail: 'Zu wenig Bestand' }, 400);
    render(<App />);
    await openWebshop();
    await userEvent.click(screen.getAllByRole('button', { name: 'Warenkorb' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Warenkorb öffnen, 1 Artikel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Zur Kasse' }));
    await userEvent.click(screen.getByRole('button', { name: 'Kreditkarte' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bestellung Aufgeben' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Zu wenig Bestand');
    expect(screen.getByRole('button', { name: 'Warenkorb öffnen, 1 Artikel' })).toBeInTheDocument();
  });
});

describe('QR deep link', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('opens the station join page for ?session=…&role=…', async () => {
    window.history.replaceState(null, '', '/?session=4827&role=station3_production');
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Station 3 – Produktion' })
    ).toBeInTheDocument();
  });

  it('ignores an invalid session code', () => {
    window.history.replaceState(null, '', '/?session=abc&role=station3_production');
    render(<App />);
    expect(
      screen.queryByRole('heading', { name: 'Station 3 – Produktion' })
    ).not.toBeInTheDocument();
  });

  it('goes to the webshop for customers and back to the dashboard view afterwards', async () => {
    window.history.replaceState(null, '', '/?session=4827&role=customer');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Webshop' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Simulation' }));
    expect(screen.getByRole('button', { name: 'Sitzung erstellen' })).toBeInTheDocument();
  });
});
