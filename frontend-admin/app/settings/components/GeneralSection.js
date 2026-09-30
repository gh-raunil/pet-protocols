"use client";

import { useState } from "react";
import { Building2, Upload, AlertCircle, Phone, MessageSquare, Mail, MapPin, FileText } from "lucide-react";

export default function GeneralSection({ form, onChange, onSave, saving }) {
  const [logoUploading, setLogoUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const address = form.address || {
    street: "",
    city: "",
    state: "",
    pincode: "",
  };

  function updateAddress(field, val) {
    onChange("address", { ...address, [field]: val });
  }

  // Handle Logo Upload (converts to base64 / sends to endpoint)
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Image size exceeds 5MB limit. Please choose a smaller photo.");
      return;
    }

    try {
      setLogoUploading(true);
      setErrorMsg("");

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result;
        onChange("image", base64Data);

        // Upload to Cloudinary or server storage
        const res = await fetch("/api/restaurant/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: base64Data, type: "logo" }),
        });
        const data = await res.json();
        if (data.success && data.url) {
          onChange("image", data.url);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to upload image. Please try again.");
    } finally {
      setLogoUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Restaurant</h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Update the basic information customers see.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* YOUR RESTAURANT CARD */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6 transition-colors">
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Your Restaurant</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Basic identity and contact details</p>
          </div>
        </div>

        {/* Restaurant Name */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
            Restaurant Name <span className="text-orange-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.name || ""}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="e.g. Pet Protocols Bistro"
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-zinc-800 transition-colors"
          />
        </div>

        {/* Restaurant Logo */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
            Restaurant Logo
          </label>
          <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center shrink-0">
              {form.image ? (
                <img src={form.image} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-7 h-7 text-zinc-400" />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 text-xs font-medium shadow-xs transition-colors">
                <Upload className="w-3.5 h-3.5 text-orange-500" />
                <span>{logoUploading ? "Uploading..." : "Upload Logo"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={logoUploading}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Square PNG or JPG (max 5MB)</p>
            </div>
          </div>
        </div>

        {/* Phone Number & WhatsApp Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-orange-500" />
              <span>Phone Number</span>
            </label>
            <input
              type="tel"
              value={form.phone || ""}
              onChange={(e) => onChange("phone", e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-zinc-800 transition-colors"
            />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">Your normal restaurant phone number</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
              <span>WhatsApp Number</span>
              <span className="text-[10px] text-zinc-400 font-normal">(Optional)</span>
            </label>
            <input
              type="tel"
              value={form.whatsappNumber || ""}
              onChange={(e) => onChange("whatsappNumber", e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-zinc-800 transition-colors"
            />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">Optional number customers can use to contact you on WhatsApp</p>
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-blue-500" />
            <span>Email</span>
          </label>
          <input
            type="email"
            value={form.email || ""}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="orders@yourrestaurant.com"
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-zinc-800 transition-colors"
          />
        </div>

        {/* Address */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-red-500" />
            <span>Address</span>
          </label>
          <input
            type="text"
            value={address.street || ""}
            onChange={(e) => updateAddress("street", e.target.value)}
            placeholder="Street address, shop / floor number, landmark"
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-zinc-800 transition-colors"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={address.city || ""}
              onChange={(e) => updateAddress("city", e.target.value)}
              placeholder="City"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-zinc-800 transition-colors"
            />
            <input
              type="text"
              value={address.state || ""}
              onChange={(e) => updateAddress("state", e.target.value)}
              placeholder="State"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-zinc-800 transition-colors"
            />
            <input
              type="text"
              value={address.pincode || ""}
              onChange={(e) => updateAddress("pincode", e.target.value)}
              placeholder="Pincode"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-zinc-800 transition-colors"
            />
          </div>
        </div>

        {/* Short Description */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-zinc-400" />
              <span>Short Description</span>
            </span>
            <span className="text-[10px] text-zinc-400 font-normal">Optional</span>
          </label>
          <input
            type="text"
            value={form.shortDescription || form.description || ""}
            onChange={(e) => {
              onChange("shortDescription", e.target.value);
              onChange("description", e.target.value);
            }}
            placeholder="e.g. Delicious pet-friendly meals and artisan coffee"
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-zinc-800 transition-colors"
          />
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">Tell customers a little about your restaurant.</p>
        </div>
      </section>
    </div>
  );
}
