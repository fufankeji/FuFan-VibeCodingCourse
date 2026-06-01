/**
 * Material Symbols Outlined wrapper · matches Stitch prototype usage:
 *   <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0/1">name</span>
 */
import type { CSSProperties } from "react";

interface MiProps {
  name: string;
  filled?: boolean;
  size?: number;
  className?: string;
  title?: string;
}

export function Mi({ name, filled = false, size, className = "", title }: MiProps) {
  const style: CSSProperties = {
    fontVariationSettings: `'FILL' ${filled ? 1 : 0}`,
  };
  if (size) style.fontSize = `${size}px`;
  return (
    <span className={`material-symbols-outlined ${className}`} style={style} title={title}>
      {name}
    </span>
  );
}
