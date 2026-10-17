import { render, screen } from '@testing-library/react';

import { makeSession } from '@/test/fixtures';

import LiveDashboard from './LiveDashboard';

describe('LiveDashboard', () => {
  it('labels the Station 5 column "Ausgelagert" like the station itself', () => {
    render(<LiveDashboard session={makeSession({ state: 'RUNNING' })} />);
    expect(screen.getByRole('columnheader', { name: 'Ausgelagert' })).toBeInTheDocument();
  });
});
