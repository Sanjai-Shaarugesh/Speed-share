import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "../components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu"

type Theme = "light" | "dark" | "system"

export function ModeToggle() {
  const [theme, setTheme] = React.useState<Theme>("system")

  // Apply the theme class to the document
  React.useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null
    const initial = saved || "system"
    setTheme(initial)

    const applyTheme = (t: Theme) => {
      if (t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }

    applyTheme(initial)

    const listener = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        applyTheme("system")
      }
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  }, [])

  React.useEffect(() => {
    localStorage.setItem("theme", theme)
    if (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [theme])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
