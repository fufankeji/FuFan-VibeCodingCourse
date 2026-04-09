import { useRef, useEffect, useCallback } from "react";

/**
 * @param deps - dependencies that trigger auto-scroll
 * @param instant - when true, use instant scroll (no CSS animation overhead during streaming)
 */
export function useAutoScroll(deps: unknown[], instant = false) {
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 80;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    userScrolledUp.current = !atBottom;
  }, []);

  useEffect(() => {
    if (!userScrolledUp.current && containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: instant ? "auto" : "smooth",
      });
    }
  }, deps);

  return { containerRef, handleScroll };
}
