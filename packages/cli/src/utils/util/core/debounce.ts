/**
 * @packageDocumentation
 * Debounce and throttle utilities.
 *
 * Provides functions for rate-limiting function execution.
 */

/**
 * Debounce utility function.
 * Delays function execution until after a specified delay has elapsed since its last invocation.
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
): (...args: Parameters<T>) => void {
  /** Timeout ID for the pending execution. */
  let timeoutId: NodeJS.Timeout | null = null;

  /** Debounced wrapper function. */
  return function debounced(...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Throttle utility function.
 * Ensures function is called at most once per specified interval.
 * @param func - Function to throttle
 * @param interval - Minimum interval between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  interval: number,
): (...args: Parameters<T>) => void {
  /** Timestamp of the last function call. */
  let lastCallTime = 0;
  /** Timeout ID for the trailing execution. */
  let timeoutId: NodeJS.Timeout | null = null;

  /** Throttled wrapper function. */
  return function throttled(...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall >= interval) {
      lastCallTime = now;
      func(...args);
    } else if (timeoutId === null) {
      const remainingTime = interval - timeSinceLastCall;
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        func(...args);
        timeoutId = null;
      }, remainingTime);
    }
  };
}
