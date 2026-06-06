import Providers from './providers'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import CartDrawer from './components/cart/CartDrawer'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata = {
  title: {
    default: 'Pet Protocols — Fresh Food, Zero Compromises',
    template: '%s | Pet Protocols',
  },
  description: 'Order fresh burgers, pizzas, momos, fries and cold drinks online. Fast delivery, premium quality.',
  keywords: ['food delivery', 'burgers', 'pizza', 'momos', 'fries', 'online food order'],
  authors: [{ name: 'Pet Protocols' }],
  openGraph: {
    title: 'Pet Protocols — Fresh Food, Zero Compromises',
    description: 'Order fresh burgers, pizzas, momos, fries and cold drinks online.',
    type: 'website',
    locale: 'en_IN',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className="bg-brand-dark text-white font-poppins min-h-screen"
        suppressHydrationWarning={true}
      >
        <Providers>
          <Toaster position="top-right" />
          <Navbar />
          <CartDrawer />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  )
}