import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Voxum by MAJ Digital",
  description: "AI models like GPT and Perplexity are new brand influencers. Our platform helps you monitor, analyze, and optimize how your brand appears in conversational AI — a must-have for your Generative Engine Optimization (GEO) strategy.",
  
  // Open Graph / Facebook
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://voxum.maj.digital",
    siteName: "Voxum by MAJ Digital",
    title: "Voxum by MAJ Digital - Generative Engine Optimization (GEO) Platform",
    description: "AI models like GPT and Perplexity are new brand influencers. Our platform helps you monitor, analyze, and optimize how your brand appears in conversational AI — a must-have for your Generative Engine Optimization (GEO) strategy.",
    images: [
      {
        url: "/og/default-og.jpg",
        width: 1200,
        height: 630,
        alt: "Voxum - Generative Engine Optimization Platform",
      },
    ],
  },
  
  // Twitter
  twitter: {
    card: "summary_large_image",
    title: "Voxum by MAJ Digital - GEO Platform",
    description: "Monitor & optimize how your brand appears in AI conversations. Essential for Generative Engine Optimization (GEO) strategy.",
    images: ["/og/twitter-card.jpg"],
  },
  
  // Métadonnées supplémentaires pour LinkedIn et Discord
  // (LinkedIn et Discord utilisent les métadonnées Open Graph)
  
  // Métadonnées supplémentaires
  keywords: [
    "Generative Engine Optimization",
    "GEO",
    "AI brand monitoring",
    "GPT optimization",
    "Perplexity optimization",
    "conversational AI",
    "brand visibility",
    "AI marketing",
    "MAJ Digital"
  ],
  
  authors: [{ name: "MAJ Digital" }],
  creator: "MAJ Digital",
  publisher: "MAJ Digital",
  
  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  
  // Alternates pour le multilingue
  alternates: {
    canonical: "https://voxum.maj.digital",
    languages: {
      "en": "https://voxum.maj.digital/en",
      "fr": "https://voxum.maj.digital/fr",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
