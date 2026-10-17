import type { ReactNode } from 'react';

type Props = {
  /** Tailwind z-index class; spelled out so Tailwind can see it. */
  zIndex: 'z-30' | 'z-40';
  /** Adds the lg padding around the content. */
  padded?: boolean;
  /** When set, a click on the backdrop itself (not on the content) calls it. */
  onClose?: () => void;
  children: ReactNode;
};

/** Full-screen scrim that centers its content (modal dialogs). */
function Overlay({ zIndex, padded = false, onClose, children }: Props) {
  return (
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-scrim${padded ? ' p-lg' : ''}`}
      onClick={onClose ? (event) => event.target === event.currentTarget && onClose() : undefined}
      role={onClose ? 'presentation' : undefined}
    >
      {children}
    </div>
  );
}

export default Overlay;
