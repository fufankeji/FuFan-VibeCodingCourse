import { useCallback, useEffect, useRef, useState } from 'react'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import type { Container, ISourceOptions } from '@tsparticles/engine'
import { useTheme } from '../contexts/ThemeContext'

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

function getParticleCount() {
  const cores = navigator.hardwareConcurrency ?? 2
  if (cores <= 2) return 20
  if (cores <= 4) return 50
  return 80
}

function buildOptions(isLight: boolean): ISourceOptions {
  return {
    fullScreen: false,
    fpsLimit: 60,
    particles: {
      number: { value: getParticleCount() },
      color: { value: isLight ? '#6366f1' : '#a5b4fc' },
      opacity: { value: { min: 0.3, max: 0.7 } },
      size: { value: { min: 1, max: 3 } },
      move: {
        enable: true,
        speed: 0.8,
        direction: 'none' as const,
        outModes: { default: 'out' as const },
      },
      links: {
        enable: true,
        distance: 150,
        color: isLight ? '#818cf8' : '#6366f1',
        opacity: 0.3,
        width: 1,
      },
    },
    detectRetina: true,
  }
}

export default function ParticleBackground() {
  const [ready, setReady] = useState(false)
  const { theme } = useTheme()
  const reducedMotion = useReducedMotion()
  const containerRef = useRef<Container | null>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine)
    }).then(() => setReady(true))
  }, [])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const container = containerRef.current
    if (container) {
      container.reset(buildOptions(theme === 'light'))
    }
  }, [theme])

  const handleParticlesLoaded = useCallback(async (container?: Container) => {
    containerRef.current = container ?? null
  }, [])

  if (reducedMotion || !ready) return null

  return (
    <Particles
      className="absolute inset-0 z-0"
      options={buildOptions(theme === 'light')}
      particlesLoaded={handleParticlesLoaded}
    />
  )
}
