// Reduced-motion preference of the operating system (RNF-2).
const query = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

/** True when the user asked the system to reduce animations. */
export function prefersReducedMotion() {
  return Boolean(query && query.matches);
}
