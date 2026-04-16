export default function AboutSection() {
  return (
    <section
      id="about"
      className="px-6 py-20 dark:bg-gray-950"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 md:flex-row md:items-start">
        <div className="w-64 shrink-0 md:w-80">
          <div className="aspect-square w-full overflow-hidden rounded-2xl bg-gray-200 dark:bg-gray-700">
            <img
              src=""
              alt="木羽Cheney 个人照片"
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
        </div>

        <div className="flex-1 text-center md:text-left">
          <h2 className="mb-8 text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">
            关于我
          </h2>
          <div className="space-y-4 text-base leading-relaxed text-gray-600 dark:text-gray-300">
            <p>
              你好，我是木羽Cheney，一名全栈开发工程师。我热衷于探索前沿技术，擅长使用 React、TypeScript 和 Node.js 构建高质量的 Web 应用。
            </p>
            <p>
              我相信好的技术应该服务于人，而不是制造复杂。在工作中，我追求代码的简洁与优雅，注重用户体验和性能优化，致力于将复杂的技术问题转化为直观的解决方案。
            </p>
            <p>
              工作之余，我喜欢记录和分享技术心得，希望通过自己的实践经验帮助更多的开发者成长。如果你对我的项目感兴趣，欢迎通过 GitHub 与我交流。
            </p>
          </div>
        </div>
      </div>

      <div className="mt-16 text-center">
        <span className="text-2xl font-bold tracking-widest text-indigo-600 dark:text-indigo-400 md:text-3xl">
          赋范空间
        </span>
      </div>
    </section>
  )
}
