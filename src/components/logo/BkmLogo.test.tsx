import { render } from '@testing-library/react';

import BkmLogo from './BkmLogo';

describe('BkmLogo', () => {
  it('renders an svg and forwards the className', () => {
    const { container } = render(<BkmLogo className="h-12" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('h-12');
  });
});
