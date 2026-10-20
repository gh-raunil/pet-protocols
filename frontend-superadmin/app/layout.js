import Providers from "./providers";
import { ThemeProvider } from "../components/ui/ThemeProvider";
import { ThemeScript } from "../components/ui/ThemeScript";
import AppShell from "../components/layout/AppShell";
import RichToaster from "../components/ui/RichToaster";
import "./globals.css";

export const metadata = {
  title: {
    default: "Platform Management — Super Admin",
    template: "%s | Super Admin",
  },
  description:
    "Enterprise Multi-Tenant Infrastructure — Manage multi-tenant restaurants, restaurant admins, and monitor overall platform health.",
  authors: [{ name: "पेट Protocols" }],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className="min-h-screen antialiased selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-500/30 dark:selection:text-indigo-200"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <Providers>
            <RichToaster />
            <AppShell>{children}</AppShell>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}