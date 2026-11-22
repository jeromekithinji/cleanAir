import confetti from "canvas-confetti"

export function celebrate() {
  const o = {
    colors: ["#3B6255", "#8BA49A", "#CBDED3", "#D2C49E", "#7DB898"],
    disableForReducedMotion: true,
    zIndex: 2000,
  }
  confetti({ ...o, particleCount: 90, spread: 75, origin: { x: 0.5, y: 0.7 } })
  setTimeout(() => {
    confetti({ ...o, particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.8 } })
    confetti({ ...o, particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.8 } })
  }, 250)
}