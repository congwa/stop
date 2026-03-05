import { Moon, Sun } from "lucide-react"
import { useTheme } from "./ThemeProvider"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    // If it's system, we switch to dark or light explicitly
    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      setTheme(isDark ? "light" : "dark")
    } else {
      setTheme(theme === "dark" ? "light" : "dark")
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center justify-center"
      title="切换主题"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">切换主题</span>
    </button>
  )
}
