import type { Metadata } from "next"
import { Fraunces, Inter } from "next/font/google"
import "./globals.css"

const sans = Inter({
  variable: "--font-sans-ui",
  subsets: ["latin"],
  display: "swap",
})

const serif = Fraunces({
  variable: "--font-serif-display",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Architectural viewer",
  description: "Interactive architectural 3D viewer",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
