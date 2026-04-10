import ProjectCard from './ProjectCard'

export interface Project {
  title: string
  description: string
  image: string
  github: string
}

const PROJECTS: Project[] = [
  {
    title: 'Personal Website',
    description: '基于 React 19 + Vite + Tailwind CSS 构建的个人品牌站，支持暗色模式和粒子背景效果。',
    image: '',
    github: 'https://github.com',
  },
  {
    title: 'Task Manager',
    description: '全栈任务管理应用，使用 TypeScript + Node.js + PostgreSQL，支持实时协作编辑。',
    image: '',
    github: 'https://github.com',
  },
  {
    title: 'CLI Toolkit',
    description: '开发者效率工具集，包含代码生成器、项目脚手架和自动化部署脚本。',
    image: '',
    github: 'https://github.com',
  },
  {
    title: 'Design System',
    description: '企业级 UI 组件库，基于 React + Storybook，提供 30+ 可复用组件和完整的设计规范。',
    image: '',
    github: 'https://github.com',
  },
]

export default function ProjectSection() {
  return (
    <section
      id="projects"
      className="bg-gray-50 px-6 py-20 dark:bg-gray-900"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-12 text-center text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">
          项目展示
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {PROJECTS.map((project) => (
            <ProjectCard key={project.title} project={project} />
          ))}
        </div>
      </div>
    </section>
  )
}
