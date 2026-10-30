import { Chelsea_Market } from "next/font/google"

import "./globals.css"
import { cn } from "@/lib/utils"
import type { Metadata, Viewport } from "next"

const chelsea = Chelsea_Market({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: "400",
})

const baseUrl = "https://meloettaapp.vercel.app"

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  alternates: { canonical: baseUrl },
  title: "Meloetta",
  description: "Practice reading sheet music",
  keywords: ["sheet music", "sheet", "music"],
  openGraph: {
    title: "Meloetta",
    description: "Practice reading sheet music",
    url: new URL(baseUrl),
    siteName: "Meloetta",
    locale: "en-US",
    type: "website",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fcfefd",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", "font-sans", chelsea.variable)}
    >
      <body>{children}</body>
    </html>
  )
}
