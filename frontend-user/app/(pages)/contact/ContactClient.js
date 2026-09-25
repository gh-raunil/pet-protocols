"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Mail,
  Phone,
  MessageSquare,
  Building2,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  ExternalLink,
} from "lucide-react";

export default function ContactClient() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  useEffect(() => {
    async function loadRestaurants() {
      try {
        setLoading(true);
        const res = await fetch("/api/restaurants");
        const data = await res.json();
        if (data.success) {
          setRestaurants(data.restaurants || []);
        }
      } catch (err) {
        console.error("Failed to load restaurants for contact page", err);
      } finally {
        setLoading(false);
      }
    }
    loadRestaurants();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setForm({ name: "", email: "", subject: "", message: "" });
    }, 4000);
  };

  return (
    <main className="min-h-screen pt-32 pb-24 px-6 max-w-6xl mx-auto font-jakarta text-white">
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-widest mb-3">
          <HelpCircle size={14} /> Help & Direct Contact
        </div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-4">
          Get in <span className="text-orange-500">Touch</span>
        </h1>
        <p className="text-sm sm:text-base text-gray-400">
          Have an inquiry, feedback, or need order assistance? Contact our team or message partner kitchens directly.
        </p>
      </div>

      {/* ── SUPPORT & INQUIRY FORM GRID ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20">
        {/* Support Info Cards */}
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-[#0e1013] border border-white/10 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center mb-2">
              <Mail size={18} />
            </div>
            <h3 className="text-sm font-bold text-white">Customer Support Email</h3>
            <p className="text-xs text-gray-400">For order inquiries, billing, and general support:</p>
            <a
              href="mailto:support@petprotocols.com"
              className="text-xs font-mono text-orange-400 hover:underline block pt-1"
            >
              support@petprotocols.com
            </a>
          </div>

          <div className="p-6 rounded-2xl bg-[#0e1013] border border-white/10 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center mb-2">
              <Clock size={18} />
            </div>
            <h3 className="text-sm font-bold text-white">Support Availability</h3>
            <p className="text-xs text-gray-400">Platform assistance is available during kitchen operating hours:</p>
            <p className="text-xs font-semibold text-gray-300 pt-1">
              Monday – Sunday: 10:00 AM – 11:00 PM
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0e1013] border border-white/10 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center mb-2">
              <MapPin size={18} />
            </div>
            <h3 className="text-sm font-bold text-white">Headquarters</h3>
            <p className="text-xs text-gray-400">
              Pet Protocols Central Culinary Hub
              <br />
              Bangalore, Karnataka, India
            </p>
          </div>
        </div>

        {/* Send a Message Form */}
        <div className="lg:col-span-2 p-8 rounded-3xl bg-[#0e1013] border border-white/10 shadow-xl">
          <h2 className="text-xl font-extrabold text-white mb-1">Send Us a Message</h2>
          <p className="text-xs text-gray-400 mb-6">
            We value your experience. Drop us a note and our customer delight team will get back to you.
          </p>

          {submitted ? (
            <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-emerald-300">Message Received!</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Thank you for reaching out. A Pet Protocols team representative will review your message shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Alex Morgan"
                    className="w-full bg-[#14161a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="alex@example.com"
                    className="w-full bg-[#14161a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Order query, partnership, or general inquiry"
                  className="w-full bg-[#14161a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">
                  Message
                </label>
                <textarea
                  rows={4}
                  required
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Write your message here..."
                  className="w-full bg-[#14161a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500 transition"
                />
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition shadow-md shadow-orange-500/20"
              >
                <Send size={14} />
                <span>Send Message</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── PARTNER KITCHENS DIRECT CONTACT SECTION ─────────────── */}
      <div className="border-t border-white/10 pt-16">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Building2 size={14} /> Partner Kitchens Directory
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Contact Your Local Kitchen
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Connect directly with partner restaurants for dietary questions, preparation updates, or special requests.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-48 rounded-2xl bg-white/5 border border-white/10 animate-pulse p-6"
              />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="p-12 rounded-2xl bg-[#0e1013] border border-white/10 text-center text-gray-400">
            <Building2 className="w-10 h-10 mx-auto text-gray-600 mb-2" />
            <p className="text-sm font-semibold text-gray-300">No active partner kitchens listed yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.map((restaurant) => {
              const hasWhatsapp = Boolean(
                restaurant.whatsappNumber && restaurant.whatsappNumber.trim().length > 0
              );
              const cleanWaDigits = hasWhatsapp
                ? restaurant.whatsappNumber.replace(/\D/g, "")
                : "";

              return (
                <div
                  key={restaurant._id}
                  className="p-6 rounded-2xl bg-[#0e1013] border border-white/10 hover:border-white/20 transition shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="text-base font-bold text-white leading-tight">
                          {restaurant.name}
                        </h3>
                        {restaurant.cuisineType?.length > 0 && (
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {restaurant.cuisineType.slice(0, 3).join(" • ")}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full shrink-0">
                        ★ {restaurant.rating || "4.8"}
                      </span>
                    </div>

                    {restaurant.address?.street && (
                      <p className="text-xs text-gray-400 flex items-start gap-1.5 mb-3">
                        <MapPin size={13} className="text-orange-400 shrink-0 mt-0.5" />
                        <span>
                          {restaurant.address.street}
                          {restaurant.address.city ? `, ${restaurant.address.city}` : ""}
                        </span>
                      </p>
                    )}

                    {/* Standard Phone (Respect showPhoneToCustomers flag) */}
                    <div className="pt-3 border-t border-white/5 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                        Telephone
                      </span>
                      {restaurant.phone && restaurant.showPhoneToCustomers !== false ? (
                        <a
                          href={`tel:${restaurant.phone.replace(/\s+/g, "")}`}
                          className="text-xs font-semibold text-gray-200 hover:text-orange-400 flex items-center gap-1.5 transition"
                        >
                          <Phone size={12} className="text-orange-400" />
                          <span>{restaurant.phone}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-gray-500">
                          {restaurant.showPhoneToCustomers === false ? "Phone inquiries disabled" : "Not provided"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* WhatsApp Section: ONLY rendered when enabled by restaurant and provided */}
                  <div className="mt-5 pt-4 border-t border-white/5">
                    {hasWhatsapp && restaurant.showWhatsappToCustomers !== false ? (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                          Contact Restaurant
                        </span>
                        <a
                          href={`https://wa.me/${cleanWaDigits}?text=${encodeURIComponent(
                            `Hi ${restaurant.name}, I'm contacting you via Pet Protocols regarding an order inquiry.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
                        >
                          <MessageSquare size={13} />
                          <span>Chat on WhatsApp</span>
                          <ExternalLink size={11} className="opacity-70" />
                        </a>
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-500 flex items-center gap-1.5 py-1">
                        <span>WhatsApp direct messaging unavailable</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
