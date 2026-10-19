import Providers from "./providers";
import { ThemeProvider, ThemeScript } from "../components/ui/ThemeProvider";
import AppShell from "../components/layout/AppShell";
import AdminServiceWorkerRegister from "../components/pwa/AdminServiceWorkerRegister";
import RichToaster from "../components/ui/RichToaster";
import "./globals.css";

export const metadata = {
  title: {
    default: "पेट Protocols — Fresh Food, Zero Compromises",
    template: "%s | पेट Protocols",
  },
  description:
    "Order fresh burgers, pizzas, momos, fries and cold drinks online across top kitchens.",
  keywords: ["food delivery", "burgers", "pizza", "momos", "fries", "multi-restaurant food order"],
  authors: [{ name: "पेट Protocols" }],
  openGraph: {
    title: "पेट Protocols — Fresh Food, Zero Compromises",
    description: "Order fresh food across top partnered restaurants and cloud kitchens.",
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