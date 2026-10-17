import { STATION_NAMES } from '@/types/production';
import type { StationId } from '@/types/simulation';

type Props = {
  stationId: StationId;
  sessionId: string;
  studentName: string;
  onLeave: () => void;
  subtitle?: string;
};

/** Header shared by all station screens: eyebrow, title, subtitle, occupant. */
function StationHeader({ stationId, sessionId, studentName, onLeave, subtitle }: Props) {
  return (
    <header className="mb-xxl flex flex-col gap-sm border-b-2 pb-lg">
      <span className="text-sm tracking-widest text-ink-muted">
        STATION {stationId} · SITZUNG {sessionId}
      </span>
      <h1 className="text-2xl font-bold leading-tight text-ink">{STATION_NAMES[stationId]}</h1>
      {subtitle && <p className="text-ink-muted">{subtitle}</p>}
      <div className="flex flex-wrap items-center gap-md text-sm text-ink-muted">
        <span>{studentName}</span>
        <button className="underline" onClick={onLeave} type="button">
          Station verlassen
        </button>
      </div>
    </header>
  );
}

export default StationHeader;
