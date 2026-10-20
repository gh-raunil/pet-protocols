import Providers from "./providers";
import { ThemeProvider, ThemeScript } from "../components/ui/ThemeProvider";
import AppShell from "../components/layout/AppShell";
import AdminServiceWorkerRegister from "../components/pwa/AdminServiceWorkerRegister";
import RichToaster from "../components/ui/RichToaster";
import "./globals.css";

export const metadata = {
  title: {
    default: "पेट Protocols — Restaurant Management & Kitchen OS",
    template: "%s | पेट Protocols Restaurant Portal",
  },
  description:
    "Enterprise restaurant operations, live kitchen display system, staff station workspace, and delivery logistics.",
  keywords: ["restaurant management", "kitchen display system", "pos billing", "cloud kitchen os", "food orders"],
  authors: [{ name: "पेट Protocols" }],
  openGraph: {
    title: "पेट Protocols — Restaurant Management & Kitchen OS",
    description: "Enterprise restaurant operations portal for Pet Protocols partnered kitchens.",
    type: "website",
    locale: "en_IN",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen antialiased bg-[var(--bg-main)] text-[var(--text-main)] font-jakarta" suppressHydrationWarning>
        <ThemeProvider>
          <Providers>
            <AdminServiceWorkerRegister />
            <RichToaster />
            <AppShell>{children}</AppShell>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}