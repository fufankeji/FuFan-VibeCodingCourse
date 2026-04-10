import { lazy, Suspense } from 'react'

const ParticleBackground = lazy(() => import('./ParticleBackground'))

export default function HeroSection() {
  return (
    <section className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950">
      <div className="pointer-events-none absolute inset-0 z-0">
        <Suspense fallback={null}>
          <ParticleBackground />
        </Suspense>
      </div>
      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white md:text-6xl">
          木羽Cheney
        </h1>
        <p className="mt-4 text-lg font-medium text-indigo-600 dark:text-indigo-400 md:text-xl">
          全栈开发工程师
        </p>
        <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg">
          热爱技术，专注于构建优雅且高性能的 Web 应用
        </p>
        <a
          href="#projects"
          className="mt-8 inline-block rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 md:text-base"
        >
          查看我的项目 →
        </a>
      </div>
    </section>
  )
}
