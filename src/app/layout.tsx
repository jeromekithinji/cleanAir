import type { Metadata, Viewport } from "next"
import { Playfair_Display } from "next/font/google"
import { APP_NAME } from "@/data/mock"
import "./globals.css"

const playfair = Playfair_Display({
  variable: "--font-playfair",
  weight: "700",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Walking and biking routes in Montréal that avoid busy, polluted roads.",
  applicationName: APP_NAME,
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E2DFDA" },
    { media: "(prefers-color-scheme: dark)", color: "#1E2623" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={playfair.variable}>
      <body>{children}</body>
    </html>
  )
}
