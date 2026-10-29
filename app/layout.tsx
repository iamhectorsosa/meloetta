import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { cn } from "@/lib/utils"
import type { Metadata } from "next"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const baseUrl = "https://meloetta.vercel.app"

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable
      )}
    >
      <body>{children}</body>
    </html>
  )
}
