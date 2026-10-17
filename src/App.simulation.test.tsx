import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';

import { API_KEY_STORAGE_KEY } from '@/hooks/useApiKeyInit';
import { jsonResponse, makeSession } from '@/test/fixtures';

import App from './App';

let fetchMock: ReturnType<typeof vi.fn>;
const paths = () =>
  fetchMock.mock.calls.map(([url]) => String(url).replace(/^https?:\/\/[^/]+/, ''));

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn() })
  );
  fetchMock = vi.fn((url: string) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '');
    if (path.endsWith('/customer-join') || path.endsWith('/orders/add')) {
      return Promise.resolve(jsonResponse(makeSession()));
    }
    return Promise.resolve(jsonResponse({}, 404));
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
  document.documentElement.className = '';
});

describe('simulation webshop (customer QR link)', () => {
  it('orders from the static catalogue and talks only to the simulation server', async () => {
    window.history.replaceState(null, '', '/?session=4827&role=customer');
    render(<App />);

    expect(await screen.findByRole('status')).toHaveTextContent('Simulations-Modus aktiv');
    await userEvent.click(screen.getAllByRole('button', { name: 'Warenkorb' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Warenkorb öffnen, 1 Artikel' }));
    const drawer = screen.getByRole('complementary', { name: 'Warenkorb' });
    await userEvent.click(within(drawer).getByRole('button', { name: 'Zur Kasse' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bestellung Aufgeben' }));
    expect(await screen.findByText('Vielen Dank für Ihre Bestellung!')).toBeInTheDocument();

    const orderCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/simulation/session/4827/orders/add')
    );
    expect(JSON.parse(orderCall![1].body)).toEqual({ items: [{ variant: 'S-RT', quantity: 1 }] });

    const called = paths();
    expect(called.some((path) => path.startsWith('/article/'))).toBe(false);
    expect(called.some((path) => path.startsWith('/order/'))).toBe(false);
    expect(called.some((path) => path.startsWith('/apikey'))).toBe(false);
    expect(called.every((path) => path.startsWith('/simulation/'))).toBe(true);
  });

  it('keeps the simulation mode after navigating away and back', async () => {
    window.history.replaceState(null, '', '/?session=4827&role=customer');
    render(<App />);
    await screen.findByText(/Simulations-Modus aktiv/);
    await userEvent.click(screen.getByRole('button', { name: 'Home' }));
    await userEvent.click(screen.getByRole('button', { name: 'Webshop' }));
    expect(screen.getByRole('status')).toHaveTextContent('Sitzung 4827');
  });
});

describe('leaving the simulation shop (BUG-09)', () => {
  it('clears URL params, stored session and cart, and returns to the ERP shop', async () => {
    window.history.replaceState(null, '', '/?session=4827&role=customer');
    render(<App />);
    await screen.findByText(/Simulations-Modus aktiv/);
    await userEvent.click(screen.getAllByRole('button', { name: 'Warenkorb' })[0]);
    expect(screen.getByRole('button', { name: 'Warenkorb öffnen, 1 Artikel' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Simulation verlassen' }));

    expect(screen.queryByText(/Simulations-Modus aktiv/)).not.toBeInTheDocument();
    expect(window.location.search).toBe('');
    expect(sessionStorage.getItem('simulation_shop_session')).toBeNull();
    expect(screen.queryByRole('button', { name: /Warenkorb öffnen, 1 Artikel/ })).toBeNull();
  });
});

describe('single join link /join/<code>', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockImplementation((url: string) => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, '');
      if (path.endsWith('/claim') || path.endsWith('/customer-join'))
        return Promise.resolve(jsonResponse(makeSession()));
      if (path === '/simulation/session/4827') return Promise.resolve(jsonResponse(makeSession()));
      return Promise.resolve(jsonResponse({}, 404));
    });
  });

  it('opens the join page without any ERP request', async () => {
    window.history.replaceState(null, '', '/join/4827');
    render(<App />);
    expect(await screen.findByText('Sitzung 4827')).toBeInTheDocument();
    expect(screen.getByLabelText('Benutzername')).toBeInTheDocument();
    expect(paths().every((path) => path.startsWith('/simulation/'))).toBe(true);
  });

  it('sends a customer from the join page into the simulation shop', async () => {
    window.history.replaceState(null, '', '/join/4827');
    render(<App />);
    await userEvent.click(await screen.findByRole('radio', { name: /Kunde/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Zum WebShop' }));

    expect(await screen.findByText(/Simulations-Modus aktiv/)).toBeInTheDocument();
    expect(sessionStorage.getItem('simulation_shop_session')).toBe('4827');
    expect(paths().every((path) => path.startsWith('/simulation/'))).toBe(true);
  });
});

describe('ERP API key', () => {
  beforeEach(() => {
    fetchMock.mockImplementation((url: string) => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, '');
      if (path === '/apikey/create') return Promise.resolve(jsonResponse({ apikey: 'fresh' }));
      if (path.startsWith('/article/')) return Promise.resolve(jsonResponse({ articles: [] }));
      return Promise.resolve(jsonResponse(makeSession()));
    });
  });

  const keyRequests = () => paths().filter((path) => path.startsWith('/apikey'));
  const erpRequests = () => paths().filter((path) => !path.startsWith('/simulation/'));

  it.each([
    ['station QR link', '/?session=4827&role=station3_production'],
    ['customer link', '/?session=4827&role=customer'],
    ['simulation mode link', '/?mode=simulation&session=4827'],
  ])('does not request a key for the %s', async (_name, url) => {
    window.history.replaceState(null, '', url);
    render(<App />);
    await screen.findAllByRole('heading');
    expect(erpRequests()).toEqual([]);
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
  });

  it('keeps skipping the key for a customer link while navigating between pages', async () => {
    window.history.replaceState(null, '', '/?session=4827&role=customer');
    render(<App />);
    await screen.findByRole('status');
    for (const page of ['Simulation', 'Home', 'Webshop', 'Simulation', 'Webshop']) {
      await userEvent.click(screen.getByRole('button', { name: page }));
    }
    expect(keyRequests()).toHaveLength(0);
    expect(erpRequests()).toEqual([]);
  });

  it('requests the key when the plain ERP shop opens', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Webshop' }));
    await vi.waitFor(() => expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe('fresh'));
    expect(keyRequests()).toHaveLength(1);
  });

  it('fetches the key when switching from a station link to the ERP webshop', async () => {
    window.history.replaceState(null, '', '/?session=4827&role=station3_production');
    render(<App />);
    await screen.findByRole('heading', { name: 'Station 3 – Produktion' });
    expect(keyRequests()).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Webshop' }));
    await vi.waitFor(() => expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe('fresh'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
