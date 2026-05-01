import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '1-TouchBot',
  description: 'Build powerful Telegram bots — no coding required'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Apply saved theme before paint — prevents flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var t = localStorage.getItem('theme') || 'dark';
              document.documentElement.setAttribute('data-theme', t);
            } catch(e){}
          })();
        `}} />
      </head>
      <body>
        {/* Ambient green glow blobs — visible on every page */}
        <div className="glow-blob glow-blob-tl" aria-hidden="true" />
        <div className="glow-blob glow-blob-br" aria-hidden="true" />
        {children}
      </body>
    </html>
  )
}
