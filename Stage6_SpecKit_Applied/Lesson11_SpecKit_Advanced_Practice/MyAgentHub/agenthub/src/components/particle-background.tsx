"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
};

function parseHslTriple(raw: string): { h: number; s: number; l: number } | null {
  const m = raw.trim().match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i);
  if (!m) return null;
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      // 静止降级：只画一次柔和渐变，不进入 rAF 循环
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-primary-default")
        .trim();
      const hsl = parseHslTriple(raw);
      const ctx = canvas.getContext("2d");
      if (!ctx || !hsl) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
      const g = ctx.createRadialGradient(
        canvas.clientWidth / 2,
        canvas.clientHeight / 2,
        0,
        canvas.clientWidth / 2,
        canvas.clientHeight / 2,
        Math.max(canvas.clientWidth, canvas.clientHeight) / 1.5,
      );
      g.addColorStop(0, `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.08)`);
      g.addColorStop(1, `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let rafId = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = () => {
      const count = window.innerWidth < 768 ? 20 : 60;
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: 1 + Math.random() * 2,
        alpha: 0.3 + Math.random() * 0.3,
      }));
    };

    const readColor = (): { h: number; s: number; l: number } => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-primary-default")
        .trim();
      return parseHslTriple(raw) ?? { h: 220, s: 90, l: 60 };
    };

    let color = readColor();

    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, ${p.alpha})`;
        ctx.fill();
      }
      rafId = requestAnimationFrame(tick);
    };

    const start = () => {
      resize();
      spawn();
      color = readColor();
      rafId = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    };

    const onResize = () => {
      resize();
      spawn();
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else if (!rafId) rafId = requestAnimationFrame(tick);
    };

    start();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
