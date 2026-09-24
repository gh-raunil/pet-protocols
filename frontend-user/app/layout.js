import Providers from "./providers";
import { ThemeProvider, ThemeScript } from "../components/ui/ThemeProvider";
import AppShell from "../components/layout/AppShell";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata = {
  title: {
    default: "Pet Protocols — Fresh Food, Zero Compromises",
    template: "%s | Pet Protocols",
  },
  description:
    "Order fresh burgers, pizzas, momos, fries and cold drinks online across top kitchens.",
  keywords: ["food delivery", "burgers", "pizza", "momos", "fries", "multi-restaurant food order"],
  authors: [{ name: "Pet Protocols" }],
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
      </head>
      <body className="min-h-screen antialiased bg-black text-white" suppressHydrationWarning>
        <ThemeProvider>
          <Providers>
            <Toaster position="top-right" />
            <AppShell>{children}</AppShell>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}