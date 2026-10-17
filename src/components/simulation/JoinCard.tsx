import type { ReactNode } from 'react';

import getPublicBaseUrl from '@/api/getPublicBaseUrl';
import { buildJoinLink } from '@/types/simulationRoles';

import QrCodeCard from './QrCodeCard';

type Props = {
  sessionId: string;
  /** Rendered below the QR block inside the same card (the occupancy list). */
  children?: ReactNode;
};

/** One QR code and link for everybody; name and role are picked on the join page. */
function JoinCard({ sessionId, children }: Props) {
  return (
    <section className="rounded-lg border bg-card p-xl shadow-sticker">
      <h2 className="mb-md text-lg font-bold text-ink">Teilnehmende beitreten lassen</h2>
      <QrCodeCard label="Beitrittsseite" link={buildJoinLink(getPublicBaseUrl(), sessionId)} />
      {children}
    </section>
  );
}

export default JoinCard;
