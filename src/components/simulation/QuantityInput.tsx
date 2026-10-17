import { useEffect, useState } from 'react';

import { MAX_QUANTITY, QUANTITY_HINT_ID } from './quantities';
import type { InvalidChangeHandler } from './quantities';

const WHOLE_NUMBER = /^\d+$/;

/**
 * Number field with its own text state: the user can clear it (Backspace on "0") and type freely.
 * A valid whole number 0–999 is passed up immediately, an empty field counts as 0, anything else is
 * shown as invalid and *not* silently rewritten (the previous valid value stays in the draft).
 */
function QuantityInput({
  label,
  value,
  disabled,
  onChange,
  onInvalidChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
  onInvalidChange: InvalidChangeHandler;
}) {
  const [text, setText] = useState(String(value));
  const parsed = text === '' ? 0 : WHOLE_NUMBER.test(text) ? Number(text) : null;
  const isInvalid = parsed === null || parsed > MAX_QUANTITY;

  useEffect(() => {
    onInvalidChange(label, isInvalid);
    return () => onInvalidChange(label, false);
  }, [isInvalid, label, onInvalidChange]);

  // Follow outside changes (save, reset) – but never overwrite what is being typed.
  useEffect(() => {
    setText((current) => {
      // An empty field means 0, so clearing "5" (value becomes 0) must keep the field empty.
      const currentValue = current === '' ? 0 : WHOLE_NUMBER.test(current) ? Number(current) : NaN;
      return currentValue === value ? current : String(value);
    });
  }, [value]);

  return (
    <div>
      <input
        aria-describedby={isInvalid ? QUANTITY_HINT_ID : undefined}
        aria-invalid={isInvalid}
        aria-label={label}
        className={`mt-xs block w-full rounded-lg border bg-bg px-md py-sm text-ink ${
          isInvalid ? 'border-danger' : ''
        }`}
        disabled={disabled}
        inputMode="numeric"
        onBlur={() => !isInvalid && setText(String(parsed))}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          const nextValue = next === '' ? 0 : WHOLE_NUMBER.test(next) ? Number(next) : null;
          if (nextValue !== null && nextValue <= MAX_QUANTITY) onChange(nextValue);
        }}
        value={text}
      />
    </div>
  );
}

export default QuantityInput;
