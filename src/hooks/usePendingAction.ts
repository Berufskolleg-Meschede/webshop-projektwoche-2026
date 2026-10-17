import { useRef, useState } from 'react';

/**
 * Guards a confirm button against double clicks: `run` ignores calls while one is in flight,
 * and `isPending` lets the caller disable the button during the request.
 */
export function usePendingAction() {
  const [isPending, setIsPending] = useState(false);
  const isRunningRef = useRef(false);

  async function run(action: () => Promise<unknown> | unknown): Promise<void> {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsPending(true);
    try {
      await action();
    } finally {
      isRunningRef.current = false;
      setIsPending(false);
    }
  }

  return { isPending, run };
}
