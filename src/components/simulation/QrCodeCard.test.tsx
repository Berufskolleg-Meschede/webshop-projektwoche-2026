import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import QrCodeCard from './QrCodeCard';

const link = 'http://localhost/#/join/1234/1';

function setup() {
  render(<QrCodeCard label="Station 1" link={link} />);
}

describe('QrCodeCard', () => {
  it('opens the QR dialog from the button and closes it again', async () => {
    setup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /QR-Code anzeigen/ }));
    expect(screen.getByRole('dialog', { name: 'QR-Code Station 1' })).toBeInTheDocument();
    expect(screen.getByText(link)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the QR dialog with Escape', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /QR-Code anzeigen/ }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('copies the link and shows the confirmation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Link kopieren: Station 1' }));
    expect(writeText).toHaveBeenCalledWith(link);
    expect(await screen.findByText('Kopiert')).toBeInTheDocument();
  });

  it('stays quiet when the clipboard is not available', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('insecure context'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Link kopieren: Station 1' }));
    expect(writeText).toHaveBeenCalledOnce();
    expect(screen.queryByText('Kopiert')).not.toBeInTheDocument();
  });
});
