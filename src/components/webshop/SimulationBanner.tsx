import { FlaskConical } from 'lucide-react';

type Props = {
  sessionId: string;
  onExit: () => void;
};

function SimulationBanner({ sessionId, onExit }: Props) {
  return (
    <div
      className="mb-xxl flex flex-wrap items-center gap-md rounded-lg border bg-primary px-xl py-lg text-on-primary shadow-sticker"
      role="status"
    >
      <FlaskConical aria-hidden="true" size={24} strokeWidth={2.25} />
      <p className="flex-1 text-sm font-semibold">
        Simulations-Modus aktiv: Deine Bestellung fließt in die aktuelle Tagesproduktion der Anlage
        ein.
      </p>
      <span className="rounded-full border bg-card px-md py-xs text-sm font-bold text-ink">
        Sitzung {sessionId}
      </span>
      <button
        className="rounded-full border bg-card px-md py-xs text-sm font-semibold text-ink"
        onClick={onExit}
        type="button"
      >
        Simulation verlassen
      </button>
    </div>
  );
}

export default SimulationBanner;
