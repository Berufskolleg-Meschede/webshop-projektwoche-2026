import { ArrowRight } from 'lucide-react';

const baseStyles =
  'group inline-flex items-center justify-between gap-lg rounded-full px-xxl py-md text-sm font-semibold transition-all duration-300 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

const disabledStyles = 'cursor-not-allowed opacity-50 hover:translate-y-0 hover:shadow-sticker';

const variants = {
  outline: 'bg-card text-ink shadow-sticker hover:shadow-sticker-hover active:shadow-sticker-press',
  solid:
    'bg-primary text-on-primary shadow-sticker hover:shadow-sticker-hover active:shadow-sticker-press',
};

type CTAButtonProps = {
  label: string;
  variant?: keyof typeof variants;
  onClick?: () => void;
  disabled?: boolean;
};

function CTAButton({ label, variant = 'outline', onClick, disabled = false }: CTAButtonProps) {
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${disabled ? disabledStyles : ''}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-current text-current transition-transform duration-300 group-hover:translate-x-1 group-disabled:translate-x-0">
        <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}

export default CTAButton;
