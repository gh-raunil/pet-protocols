"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import RestaurantAdminNav from "@/components/layout/RestaurantAdminNav";
import {
  Settings,
  Building,
  MapPin,
  Phone,
  Mail,
  Clock,
  Utensils,
  CheckCircle2,
  AlertTriangle,
  Save,
  RefreshCw,
  MessageSquare,
} from "lucide-react";

export default function SettingsClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [platformSupportWhatsapp, setPlatformSupportWhatsapp] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    cuisineType: "",
    phone: "",
    whatsappNumber: "",
    email: "",
    openingHours: "10:00 AM - 11:00 PM",
    address: {
      street: "",
      city: "",
      state: "",
      pincode: "",
    },
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  async function loadSettings() {
    try {
      setLoading(true);
      const res = await fetch("/api/restaurant/settings");
      const data = await res.json();
      if (data.success && data.restaurant) {
        const r = data.restaurant;
        setForm({
          name: r.name || "",
          description: r.description || "",
          cuisineType: Array.isArray(r.cuisineType) ? r.cuisineType.join(", ") : r.cuisineType || "",
          phone: r.phone || "",
          whatsappNumber: r.whatsappNumber || "",
          email: r.email || "",
          openingHours: r.openingHours || "10:00 AM - 11:00 PM",
          address: {
            street: r.address?.street || "",
            city: r.address?.city || "",
            state: r.address?.state || "",
            pincode: r.address?.pincode || "",
          },
        });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to load restaurant profile." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadSupportNumber() {
      try {
        const res = await fetch("/api/restaurant/support");
        const data = await res.json();
        if (data.success && data.platformWhatsapp) {
          setPlatformSupportWhatsapp(data.platformWhatsapp);
        }
      } catch (err) {
        console.error("Support API error:", err);
      }
    }

    if (session?.user) {
      loadSettings();
      loadSupportNumber();
    }
  }, [session]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSaving(true);
      setFeedback({ type: "", message: "" });

      const res = await fetch("/api/restaurant/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cuisineType: form.cuisineType.split(",").map((s) => s.trim()),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: "Restaurant profile updated successfully!" });
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to update profile." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "An unexpected error occurred." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50/60 dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors relative selection:bg-orange-500/20 selection:text-orange-600">
      {/* Soft warm ambient background glow for light mode */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-orange-100/60 via-amber-50/30 to-transparent dark:from-orange-500/5 dark:via-transparent dark:to-transparent rounded-full blur-3xl opacity-80" />
      </div>

      <RestaurantAdminNav />
      <main className="pt-28 pb-20 px-4 sm:px-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 border-b border-stone-200/80 dark:border-white/10 pb-6">
          <span className="text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider">
            Branch Configuration
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white mt-1">
            Restaurant <span className="text-orange-500">Settings</span>
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">
            Configure contact details, address, and operating hours visible to customers.
          </p>
        </div>

        {/* ── PET PROTOCOLS PLATFORM SUPPORT ── */}
        <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/20 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm shadow-orange-500/5">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                Contact Pet Protocols
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Need operational assistance or platform support? Chat directly with the Pet Protocols operations team.
              </p>
            </div>
          </div>

          {platformSupportWhatsapp && (
            <a
              href={`https://wa.me/${platformSupportWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                `Hi Pet Protocols Support, this is ${form.name || "Restaurant Admin"}. I need platform support.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 shrink-0 w-fit active:scale-95"
            >
              <MessageSquare size={14} />
              <span>WhatsApp Support</span>
            </a>
          )}
        </div>

        {/* Feedback */}
        {feedback.message && (
          <div
            className={`mb-6 p-4 rounded-2xl flex items-center justify-between border ${
              feedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-300"
            }`}
          >
            <div className="flex items-center gap-3">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
              )}
              <p className="text-sm font-medium">{feedback.message}</p>
            </div>
            <button
              onClick={() => setFeedback({ type: "", message: "" })}
              className="text-xs opacity-70 hover:opacity-100 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex justify-center text-orange-500">
            <RefreshCw className="animate-spin w-8 h-8" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-3xl p-6 md:p-8 shadow-sm shadow-stone-200/40 dark:shadow-none space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase mb-1.5">
                  Restaurant Name
                </label>
                <div className="flex items-center bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-4 py-3 focus-within:border-orange-500 transition">
                  <Building className="text-stone-400 dark:text-stone-500 w-5 h-5 mr-3 shrink-0" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    className="w-full bg-transparent text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase mb-1.5">
                  Description / Tagline
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Tell customers about your kitchen and specialty dishes..."
                  className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 outline-none focus:border-orange-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase mb-1.5">
                  Cuisine Specialties (comma separated)
                </label>
                <div className="flex items-center bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-4 py-3 focus-within:border-orange-500 transition">
                  <Utensils className="text-stone-400 dark:text-stone-500 w-5 h-5 mr-3 shrink-0" />
                  <input
                    type="text"
                    value={form.cuisineType}
                    onChange={(e) => setForm({ ...form, cuisineType: e.target.value })}
                    placeholder="e.g. Burgers, Italian, Street Food"
                    className="w-full bg-transparent text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase mb-1.5">
                  Operating Hours
                </label>
                <div className="flex items-center bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-4 py-3 focus-within:border-orange-500 transition">
                  <Clock className="text-stone-400 dark:text-stone-500 w-5 h-5 mr-3 shrink-0" />
                  <input
                    type="text"
                    value={form.openingHours}
                    onChange={(e) => setForm({ ...form, openingHours: e.target.value })}
                    placeholder="e.g. 10:00 AM - 11:00 PM"
                    className="w-full bg-transparent text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase mb-1.5">
                  Phone Number
                </label>
                <div className="flex items-center bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-4 py-3 focus-within:border-orange-500 transition">
                  <Phone className="text-stone-400 dark:text-stone-500 w-5 h-5 mr-3 shrink-0" />
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full bg-transparent text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase mb-1.5 flex items-center justify-between">
                  <span>WhatsApp Number (Optional)</span>
                  <span className="text-[10px] text-stone-400 normal-case font-normal">Customer chat link</span>
                </label>
                <div className="flex items-center bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-4 py-3 focus-within:border-emerald-500 transition">
                  <MessageSquare className="text-emerald-500 w-5 h-5 mr-3 shrink-0" />
                  <input
                    type="text"
                    value={form.whatsappNumber}
                    onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                    placeholder="e.g. 9876543210 (leave empty if none)"
                    className="w-full bg-transparent text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase mb-1.5">
                  Contact Email
                </label>
                <div className="flex items-center bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-4 py-3 focus-within:border-orange-500 transition">
                  <Mail className="text-stone-400 dark:text-stone-500 w-5 h-5 mr-3 shrink-0" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="manager@yourkitchen.com"
                    className="w-full bg-transparent text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="md:col-span-2 pt-4 border-t border-stone-100 dark:border-white/10">
                <h3 className="text-sm font-bold text-stone-900 dark:text-white mb-3 flex items-center gap-2">
                  <MapPin className="text-orange-500 w-4 h-4" /> Physical Address
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      placeholder="Street Address"
                      value={form.address.street}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          address: { ...form.address, street: e.target.value },
                        })
                      }
                      className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 outline-none focus:border-orange-500 transition"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="City"
                      value={form.address.city}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          address: { ...form.address, city: e.target.value },
                        })
                      }
                      className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 outline-none focus:border-orange-500 transition"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Pincode"
                      value={form.address.pincode}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          address: { ...form.address, pincode: e.target.value },
                        })
                      }
                      className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 outline-none focus:border-orange-500 transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition shadow-md shadow-orange-500/20 active:scale-95"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
