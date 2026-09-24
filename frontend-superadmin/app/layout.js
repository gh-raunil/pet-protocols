import Providers from "./providers";
import { ThemeProvider, ThemeScript } from "../components/ui/ThemeProvider";
import AppShell from "../components/layout/AppShell";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata = {
  title: {
    default: "Platform Management — Super Admin",
    template: "%s | Super Admin",
  },
  description:
    "Enterprise Multi-Tenant Infrastructure — Manage multi-tenant restaurants, restaurant admins, and monitor overall platform health.",
  authors: [{ name: "Pet Protocols" }],
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
            <Toaster
              position="top-right"
              toastOptions={{
                className: "text-xs font-medium border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] text-slate-800 dark:text-slate-200 shadow-xl",
                duration: 3500,
              }}
            />
            <AppShell>{children}</AppShell>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}