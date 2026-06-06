import React from 'react'
import Logo from './Logo'
import Link from 'next/link'
import { Facebook, Instagram, Twitter, YouTube } from '@deemlol/next-icons'

const Footer = () => {
  
  return (
    <footer className="bg-brand-card border-t border-brand-border">
      <div className="max-w-7xl mx-auto px-6 py-12">

        {/* Main 3 column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">

          {/* Column 1 — Logo + Tagline */}
          <div>
            <Logo />
            <p className="text-brand-muted text-sm mt-3 leading-relaxed">
              Delicious food made with love, <br />
              served hot and fresh every day.
            </p>
          </div>

          {/* Column 2 — Quick Links */}
          <div className="flex gap-10 justify-between w-60% md:w-50%">

            <div>
              <h3 className="text-white font-semibold mb-3">Quick Links</h3>
              <div className="flex flex-col gap-2">
                <Link href="/" className="text-brand-muted text-sm hover:text-brand-orange transition outline-none ">Home</Link>
                <Link href="/menu" className="text-brand-muted text-sm hover:text-brand-orange transition">Menu</Link>
                <Link href="/about" className="text-brand-muted text-sm hover:text-brand-orange transition">About</Link>
                <Link href="/contact" className="text-brand-muted text-sm hover:text-brand-orange transition">Contact</Link>
                <Link href="/offers" className="text-brand-muted text-sm hover:text-brand-orange transition">Offers</Link>
              </div>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-3">Categories</h3>
              <div className="flex flex-col gap-2">
                <Link href="/menu?category=Pizza" className="text-brand-muted text-sm hover:text-brand-orange transition">Pizza</Link>
                <Link href="/menu?category=Burger" className="text-brand-muted text-sm hover:text-brand-orange transition">Burger</Link>
                <Link href="/menu?category=Fries" className="text-brand-muted text-sm hover:text-brand-orange transition">Fries</Link>
                <Link href="/menu?category=Momos" className="text-brand-muted text-sm hover:text-brand-orange transition">Momos</Link>
                <Link href="/menu?category=Cold Drinks" className="text-brand-muted text-sm hover:text-brand-orange transition">Cold Drinks</Link>
              </div>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-3">Support</h3>
              <div className="flex flex-col gap-2">
                <Link href="#" className="text-brand-muted text-sm hover:text-brand-orange transition">FAQs</Link>
                <Link href="#" className="text-brand-muted text-sm hover:text-brand-orange transition">Privacy Policy</Link>
                <Link href="#" className="text-brand-muted text-sm hover:text-brand-orange transition">Terms & Conditions</Link>
                <Link href="#" className="text-brand-muted text-sm hover:text-brand-orange transition">Track Order</Link>
                <Link href="#" className="text-brand-muted text-sm hover:text-brand-orange transition">Help Center</Link>
              </div>
            </div>

          </div>

          {/* Column 3 — Follow Us */}
          <div>
            <h3 className="text-white font-semibold mb-3">Follow Us</h3>
            <p className="text-brand-muted text-sm mb-4">
              Stay updated with our latest offers and new arrivals.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-brand-muted hover:text-brand-orange transition">
                <Instagram size={20} />
              </a>
              <a href="#" className="text-brand-muted hover:text-brand-orange transition">
                <Facebook size={20} />
              </a>
              <a href="#" className="text-brand-muted hover:text-brand-orange transition">
                <YouTube size={20} />
              </a>
              <a href="#" className="text-brand-muted hover:text-brand-orange transition">
                <Twitter size={20} />
              </a>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-brand-border mt-10 pt-6 text-center text-brand-muted text-sm">
          © 2025 Pet Protocols. All rights reserved.
        </div>

      </div>
    </footer>
  )
}

export default Footer