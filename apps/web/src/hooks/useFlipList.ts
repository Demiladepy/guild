"use client";

import { useLayoutEffect, useRef } from "react";

export function useFlipList<T extends { id: string }>(
  items: T[],
  enabled = true,
) {
  const positions = useRef(new Map<string, DOMRect>());
  const refs = useRef(new Map<string, HTMLElement>());

  const setRef = (id: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(id, el);
    else refs.current.delete(id);
  };

  useLayoutEffect(() => {
    if (!enabled) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      items.forEach((item) => {
        const el = refs.current.get(item.id);
        if (el) positions.current.set(item.id, el.getBoundingClientRect());
      });
      return;
    }

    items.forEach((item) => {
      const el = refs.current.get(item.id);
      if (!el) return;

      const prev = positions.current.get(item.id);
      const next = el.getBoundingClientRect();

      if (prev) {
        const deltaY = prev.top - next.top;
        if (Math.abs(deltaY) > 1) {
          el.style.transform = `translateY(${deltaY}px)`;
          el.style.transition = "transform 0s";
          requestAnimationFrame(() => {
            el.style.transition = "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)";
            el.style.transform = "";
          });
        }
      }

      positions.current.set(item.id, next);
    });
  }, [items, enabled]);

  return setRef;
}
