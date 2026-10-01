import Providers from "./providers";
import { ThemeProvider, ThemeScript } from "../components/ui/ThemeProvider";
import { ToastProvider } from "../components/ui/ToastProvider";
import AppShell from "../components/layout/AppShell";
import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export const metadata = {
  title: {
    default: "Pet Protocols — Fresh Food, Zero Compromises",
    template: "%s | Pet Protocols",
  },
  description:
    "Discover partner restaurants, explore gourmet menus, and order fresh food easily.",
  keywords: ["food delivery", "burgers", "pizza", "momos", "fries", "multi-restaurant food order"],
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/icons/favicon-32x32.png",
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Pet Protocols — Fresh Food, Zero Compromises",
    description: "Order fresh food across top partnered restaurants and cloud kitchens.",
    type: "website",
    locale: "en_IN",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <script
          id="pwa-service-worker-init"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function(reg) {
                      console.log('[PWA] Service Worker registered with scope:', reg.scope);
                    })
                    .catch(function(err) {
                      console.warn('[PWA] Service Worker registration failed:', err);
                    });
                });
                if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function() {});
                }
              }
            `,
          }}
        />
      </head>
      <body className="min-h-screen antialiased bg-[var(--bg-main)] text-[var(--text-main)]" suppressHydrationWarning>
        <ThemeProvider>
          <ToastProvider>
            <Providers>
              <AppShell>{children}</AppShell>
            </Providers>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}