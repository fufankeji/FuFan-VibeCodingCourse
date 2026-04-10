import { ThemeProvider } from './contexts/ThemeContext'
import Navbar from './components/Navbar'
import HeroSection from './components/HeroSection'
import ProjectSection from './components/ProjectSection'
import AboutSection from './components/AboutSection'

function App() {
  return (
    <ThemeProvider>
      <Navbar />
      <main>
        <HeroSection />
        <ProjectSection />
        <AboutSection />
      </main>
    </ThemeProvider>
  )
}

export default App
