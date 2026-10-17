import { Check, Copy, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';

import Overlay from '@/components/common/Overlay';
import { useEscapeKey } from '@/hooks/useEscapeKey';

type Props = {
  label: string;
  link: string;
};

/** Role link with a copy button; the QR code opens in a modal on demand (feedback 01: only temporarily visible). */
function QrCodeCard({ label, link }: Props) {
  const [isQrVisible, setIsQrVisible] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEscapeKey(isQrVisible, () => setIsQrVisible(false));

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      // Clipboard needs a secure context; the link can still be viewed in the QR-Code modal dialog.
    }
  }

  return (
    <div className="rounded-lg border bg-card p-lg shadow-sticker-sm">
      <h3 className="mb-md font-bold text-ink">{label}</h3>
      <div className="flex flex-wrap gap-sm">
        <button
          aria-haspopup="dialog"
          className="inline-flex items-center gap-xs rounded-full border bg-card px-md py-xs text-sm text-ink"
          onClick={() => setIsQrVisible((visible) => !visible)}
          type="button"
        >
          <QrCode size={16} />
          QR-Code anzeigen
        </button>
        <button
          aria-label={`Link kopieren: ${label}`}
          className="inline-flex items-center gap-xs rounded-full border bg-card px-md py-xs text-sm text-ink"
          onClick={handleCopy}
          type="button"
        >
          {isCopied ? <Check size={16} /> : <Copy size={16} />}
          {isCopied ? 'Kopiert' : 'Link kopieren'}
        </button>
      </div>
      {isQrVisible && (
        <Overlay onClose={() => setIsQrVisible(false)} padded zIndex="z-30">
          <div
            aria-label={`QR-Code ${label}`}
            aria-modal="true"
            className="w-full max-w-[24rem] rounded-lg border bg-card p-lg text-center shadow-sticker sm:p-xxl"
            role="dialog"
          >
            <h2 className="mb-md text-lg font-bold text-ink">{label}</h2>
            {/* QR codes need a light quiet zone to scan, so this stays white in dark mode too. */}
            <div className="mb-md inline-block rounded-lg border bg-white p-md">
              <QRCodeSVG
                aria-label={`QR-Code ${label}`}
                role="img"
                size={240}
                style={{ width: '100%', height: 'auto', maxWidth: 240 }}
                value={link}
              />
            </div>
            <p className="mb-md break-all text-xs text-ink-muted">{link}</p>
            <button
              autoFocus
              className="rounded-full border bg-primary px-xxl py-md text-sm font-semibold text-on-primary shadow-sticker"
              onClick={() => setIsQrVisible(false)}
              type="button"
            >
              Schließen
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

export default QrCodeCard;
