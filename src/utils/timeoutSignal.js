// Older Android WebViews support AbortController but not AbortSignal.timeout.
// Keep requests bounded without failing before fetch can even start.
export function timeoutSignal(milliseconds) {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(milliseconds);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), milliseconds);
  return controller.signal;
}
