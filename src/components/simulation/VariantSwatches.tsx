import type { ShakerVariant } from '@/types/simulation';
import { getVariantSwatches } from '@/types/simulationCatalog';

type Props = {
  variant: ShakerVariant;
  compact?: boolean;
};

/** Lid colour dot and housing colour square of a variant. */
function VariantSwatches({ variant, compact = false }: Props) {
  const { lid, housing } = getVariantSwatches(variant);
  const size = compact ? 'h-3 w-3' : 'h-4 w-4';
  return (
    <span aria-hidden="true" className="flex items-center gap-xs">
      <span className={`${size} rounded-full border ${lid}`} />
      <span className={`${size} rounded-sm border ${housing}`} />
    </span>
  );
}

export default VariantSwatches;
