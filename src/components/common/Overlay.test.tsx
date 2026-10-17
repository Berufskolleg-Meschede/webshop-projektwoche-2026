import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Overlay from './Overlay';

describe('Overlay', () => {
  it('renders its children', () => {
    render(
      <Overlay zIndex="z-30">
        <p>Inhalt</p>
      </Overlay>
    );
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <Overlay onClose={onClose} zIndex="z-30">
        <p>Inhalt</p>
      </Overlay>
    );
    fireEvent.click(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when the content is clicked', () => {
    const onClose = vi.fn();
    render(
      <Overlay onClose={onClose} zIndex="z-30">
        <p>Inhalt</p>
      </Overlay>
    );
    fireEvent.click(screen.getByText('Inhalt'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
