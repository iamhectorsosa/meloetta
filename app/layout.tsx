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

// npx pwa-asset-generator ./assets/logo.svg ./public/icons \
//   --background "#fcfefd" \
//   --padding "0" \
//   --icon-only \
//   --favicon \
//   --type png \
//   --opaque true

// npx pwa-asset-generator ./assets/logo.svg ./public/splash \
//   --background "#fcfefd" \
//   --splash-only \
//   --portrait-only \
//   --padding "30%" \
//   --type png \
//   --opaque true

// [cssWidth, cssHeight, pixelRatio] -> file: apple-splash-{w*dpr}-{h*dpr}.png
const splashDevices: [number, number, number][] = [
  // iPhones @3x
  [440, 956, 3], // 1320x2868
  [430, 932, 3], // 1290x2796
  [428, 926, 3], // 1284x2778
  [420, 912, 3], // 1260x2736
  [414, 896, 3], // 1242x2688
  [414, 736, 3], // 1242x2208
  [402, 874, 3], // 1206x2622
  [393, 852, 3], // 1179x2556
  [390, 844, 3], // 1170x2532
  [375, 812, 3], // 1125x2436
  [360, 780, 3], // 1080x2340
  // iPhones @2x
  [414, 896, 2], // 828x1792
  [375, 667, 2], // 750x1334
  [320, 568, 2], // 640x1136
  // iPads @2x
  [1032, 1376, 2], // 2064x2752
  [1024, 1366, 2], // 2048x2732
  [834, 1210, 2], // 1668x2420
  [834, 1194, 2], // 1668x2388
  [834, 1112, 2], // 1668x2224
  [820, 1180, 2], // 1640x2360
  [810, 1080, 2], // 1620x2160
  [768, 1024, 2], // 1536x2048
  [744, 1133, 2], // 1488x2266
]

const startupImage = splashDevices.map(([w, h, dpr]) => ({
  url: `/splash/apple-splash-${w * dpr}-${h * dpr}.png`,
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
}))

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  alternates: { canonical: baseUrl },
  title: "Meloetta",
  description: "Practice reading sheet music",
  keywords: ["sheet music", "sheet", "music"],
  applicationName: "Meloetta",
  icons: {
    icon: [
      { url: "/icons/favicon-196.png", sizes: "196x196", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-icon-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Meloetta",
    statusBarStyle: "default",
    startupImage,
  },
  formatDetection: { telephone: false },
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
