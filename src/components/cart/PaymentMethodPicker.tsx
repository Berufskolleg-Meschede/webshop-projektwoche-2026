import type { ReactNode } from 'react';

import { CreditCard, Landmark } from 'lucide-react';

import type { PaymentMethod } from '@/types/checkout';

function PayPalLogo() {
  return (
    <span className="rounded-md bg-white px-sm py-xs">
      <svg
        fill="none"
        height="28"
        viewBox="0 0 80 28"
        width="80"
        xmlns="http://www.w3.org/2000/svg"
      >
        <text
          dominantBaseline="middle"
          fill="#003087"
          fontFamily="Arial, sans-serif"
          fontSize="20"
          fontWeight="bold"
          y="50%"
        >
          Pay
        </text>
        <text
          dominantBaseline="middle"
          fill="#009cde"
          fontFamily="Arial, sans-serif"
          fontSize="20"
          fontWeight="bold"
          x="36"
          y="50%"
        >
          Pal
        </text>
      </svg>
    </span>
  );
}

const PAYMENT_OPTIONS: { key: PaymentMethod; label: string; icon: ReactNode }[] = [
  {
    key: 'kreditkarte',
    label: 'Kreditkarte',
    icon: <CreditCard className="text-ink-muted" size={28} />,
  },
  { key: 'paypal', label: 'PayPal', icon: <PayPalLogo /> },
  {
    key: 'bankueberweisung',
    label: 'Banküberweisung',
    icon: <Landmark className="text-ink-muted" size={28} />,
  },
];

type Props = {
  selected: PaymentMethod | null;
  disabled: boolean;
  onSelect: (method: PaymentMethod) => void;
};

function PaymentMethodPicker({ selected, disabled, onSelect }: Props) {
  return (
    <>
      <p className="mb-lg text-sm font-semibold text-ink-muted">Bezahlmethode Auswählen</p>
      <div className="grid grid-cols-1 gap-lg sm:grid-cols-3">
        {PAYMENT_OPTIONS.map(({ key, label, icon }) => (
          <button
            aria-pressed={selected === key}
            className={`flex cursor-pointer flex-col items-center gap-md rounded-lg border bg-card px-lg py-xxl text-center text-sm font-semibold shadow-sticker-sm transition-all hover:border-primary disabled:cursor-not-allowed ${
              selected === key ? 'border-primary ring-1 ring-primary' : 'border-border'
            }`}
            disabled={disabled}
            key={key}
            onClick={() => onSelect(key)}
            type="button"
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

export default PaymentMethodPicker;
