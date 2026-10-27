"use client";

import React, { useState } from "react";
import Logo from "./Logo";
import Link from "next/link";
import { ChevronDown, Globe } from "lucide-react";

const defaultAdminUrl = "https://pet-protocols-restaurant.vercel.app";
const defaultSuperadminUrl = "https://pet-protocols-superadmin.vercel.app";

const adminLoginUrl = `${process.env.NEXT_PUBLIC_ADMIN_URL || defaultAdminUrl}/login`;
const superadminLoginUrl = `${process.env.NEXT_PUBLIC_SUPERADMIN_URL || defaultSuperadminUrl}/login`;

export default function Footer() {
  const [language, setLanguage] = useState("English");
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  return (
    <footer className="w-full bg-[#FAF7F1] dark:bg-[#0D141C] text-[var(--text-main)] border-t border-stone-200/80 dark:border-stone-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-12 pb-8">
        {/* Main 5-column navigation grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 pb-10 border-b border-stone-200/70 dark:border-stone-800">
          {/* Brand info (spans 2 cols on lg) */}
          <div className="col-span-2 space-y-3.5">
            <Link href="/" className="inline-flex items-center gap-2.5 group" aria-label="पेट Protocols Home">
              <Logo />
              <div className="flex flex-col">
                <span className="font-extrabold text-lg text-[var(--text-main)] tracking-tight group-hover:text-[var(--brand-accent)] transition">
                  पेट Protocols
                </span>
                <span className="text-[11px] text-[var(--text-muted)] font-normal leading-none mt-0.5">
                  Fresh food. Zero compromises.
                </span>
              </div>
            </Link>

            <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-sm">
              Discover top partner restaurants, chef-crafted meals, and get gourmet dishes delivered hot straight to your doorstep.
            </p>

            {/* Social Media Links matching reference image */}
            <div className="flex items-center gap-2.5 pt-1 text-[var(--text-muted)]">
              {/* Instagram */}
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Pet Protocols on Instagram"
                className="w-8 h-8 rounded-full bg-white dark:bg-[#16202A] border border-[var(--border-color)] flex items-center justify-center hover:text-[var(--brand-accent)] hover:border-[var(--brand-accent)]/50 transition active:scale-95 shadow-2xs"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              {/* Facebook */}
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Pet Protocols on Facebook"
                className="w-8 h-8 rounded-full bg-white dark:bg-[#16202A] border border-[var(--border-color)] flex items-center justify-center hover:text-[var(--brand-accent)] hover:border-[var(--brand-accent)]/50 transition active:scale-95 shadow-2xs"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z" />
                </svg>
              </a>
              {/* X / Twitter */}
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Pet Protocols on X"
                className="w-8 h-8 rounded-full bg-white dark:bg-[#16202A] border border-[var(--border-color)] flex items-center justify-center hover:text-[var(--brand-accent)] hover:border-[var(--brand-accent)]/50 transition active:scale-95 shadow-2xs"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              {/* YouTube */}
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Pet Protocols on YouTube"
                className="w-8 h-8 rounded-full bg-white dark:bg-[#16202A] border border-[var(--border-color)] flex items-center justify-center hover:text-[var(--brand-accent)] hover:border-[var(--brand-accent)]/50 transition active:scale-95 shadow-2xs"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              {/* LinkedIn */}
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Pet Protocols on LinkedIn"
                className="w-8 h-8 rounded-full bg-white dark:bg-[#16202A] border border-[var(--border-color)] flex items-center justify-center hover:text-[var(--brand-accent)] hover:border-[var(--brand-accent)]/50 transition active:scale-95 shadow-2xs"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Column 1 — COMPANY */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-3">
              Company
            </h3>
            <div className="flex flex-col gap-2 text-xs text-[var(--text-muted)]">
              <Link href="/about" className="hover:text-[var(--brand-accent)] transition">Our Story</Link>
              <Link href="/about" className="hover:text-[var(--brand-accent)] transition">Careers</Link>
              <Link href="/about" className="hover:text-[var(--brand-accent)] transition">Blog</Link>
              <Link href="/about" className="hover:text-[var(--brand-accent)] transition">Press</Link>
            </div>
          </div>

          {/* Column 2 — HELP */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-3">
              Help
            </h3>
            <div className="flex flex-col gap-2 text-xs text-[var(--text-muted)]">
              <Link href="/contact" className="hover:text-[var(--brand-accent)] transition">Help Center</Link>
              <Link href="/orders" className="hover:text-[var(--brand-accent)] transition">Track Order</Link>
              <Link href="/about" className="hover:text-[var(--brand-accent)] transition">Returns</Link>
              <Link href="/contact" className="hover:text-[var(--brand-accent)] transition">Feedback</Link>
            </div>
          </div>

          {/* Column 3 — POLICIES */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-3">
              Policies
            </h3>
            <div className="flex flex-col gap-2 text-xs text-[var(--text-muted)]">
              <Link href="/about" className="hover:text-[var(--brand-accent)] transition">Terms of Service</Link>
              <Link href="/about" className="hover:text-[var(--brand-accent)] transition">Privacy Policy</Link>
              <Link href="/about" className="hover:text-[var(--brand-accent)] transition">Cookie Policy</Link>
            </div>
          </div>

          {/* Column 4 — FOR RESTAURANTS */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-3">
              For Restaurants
            </h3>
            <div className="flex flex-col gap-2 text-xs text-[var(--text-muted)]">
              <a href={adminLoginUrl} className="hover:text-[var(--brand-accent)] transition">Restaurant Login</a>
              <a href={adminLoginUrl} className="hover:text-[var(--brand-accent)] transition">Admin Login</a>
              <a href={superadminLoginUrl} className="hover:text-[var(--brand-accent)] transition">Superadmin Login</a>
            </div>
          </div>
        </div>

        {/* Bottom Bar matching reference image with language selector */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
          <p>© {new Date().getFullYear()} पेट Protocols. All rights reserved.</p>

          <div className="relative">
            <button
              type="button"
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#16202A] border border-[var(--border-color)] hover:border-[var(--brand-accent)] text-xs text-[var(--text-main)] transition shadow-2xs"
            >
              <Globe size={13} className="text-[var(--brand-accent)]" />
              <span>{language}</span>
              <ChevronDown size={12} className="text-[var(--text-muted)]" />
            </button>

            {langMenuOpen && (
              <div className="absolute right-0 bottom-9 w-32 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl py-1 z-20">
                {["English", "Hindi", "Tamil"].map((l) => (
                  <button
                    key={l}
                    onClick={() => {
                      setLanguage(l);
                      setLangMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-main)] hover:bg-[var(--bg-sub)] hover:text-[var(--brand-accent)] transition"
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}