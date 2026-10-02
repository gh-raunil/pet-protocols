"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  User,
  Camera,
  Mail,
  Phone,
  Store,
  UtensilsCrossed,
  Volume2,
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
  Sparkles,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { CHIME_OPTIONS, getSavedChime, setSavedChime, playChime } from "@/lib/soundChimes";

export default function ProfileSection() {
  const { data: session, update } = useSession();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [profileData, setProfileData] = useState({
    name: "",
    phone: "",
    roleTitle: "Branch Operations Lead",
    image: "",
    soundAlerts: true,
  });

  const [selectedChime, setSelectedChime] = useState("bell");
  const [onDuty, setOnDuty] = useState(true);

  const isStaff = session?.user?.role === "staff";
  const restaurantName = session?.user?.restaurantName || "Partner Kitchen";

  // Load sound and duty preferences
  useEffect(() => {
    setSelectedChime(getSavedChime());
    if (typeof window !== "undefined") {
      const savedAlerts = localStorage.getItem("pet_kitchen_sound_alerts");
      if (savedAlerts !== null) {
        setProfileData((prev) => ({ ...prev, soundAlerts: savedAlerts === "true" }));
      }
    }
  }, []);

  // Fetch backend profile data
  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const res = await fetch("/api/restaurant/profile");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setProfileData((prev) => ({
              ...prev,
              name: data.user.name || session?.user?.name || "",
              phone: data.user.phone || "",
              roleTitle: data.user.roleTitle || (isStaff ? "Staff Member" : "Branch Operations Lead"),
              image: data.user.image || session?.user?.image || "",
            }));
            return;
          }
        }
      } catch (err) {
        console.error("Failed to load profile from backend:", err);
      } finally {
        setLoading(false);
      }

      // Fallback to session
      if (session?.user) {
        setProfileData((prev) => ({
          ...prev,
          name: prev.name || session.user.name || "",
          image: prev.image || session.user.image || "",
          roleTitle: isStaff ? (session.user.staffRoles?.[0] || "Staff") : "Branch Operations Lead",
        }));
      }
    }

    if (session) {
      loadProfile();
    }
  }, [session, isStaff]);

  function handleChimeChange(chimeId) {
    setSelectedChime(chimeId);
    setSavedChime(chimeId);
    playChime(chimeId, 1.0);
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Image size must be less than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;
      setProfileData((prev) => ({ ...prev, image: base64 }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/restaurant/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileData.name,
          phone: profileData.phone,
          roleTitle: profileData.roleTitle,
          image: profileData.image,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Failed to update profile.");
        return;
      }

      // Persist preferences locally
      if (typeof window !== "undefined") {
        const storageKey = isStaff
          ? `pet_protocols_staff_profile_${session?.user?.id || session?.user?.email || "staff"}`
          : "pet_protocols_manager_profile";

        localStorage.setItem(storageKey, JSON.stringify({ ...profileData, email: session?.user?.email }));
        localStorage.setItem("pet_kitchen_sound_alerts", profileData.soundAlerts ? "true" : "false");

        window.dispatchEvent(
          new CustomEvent("pet_protocols_profile_updated", {
            detail: {
              image: profileData.image,
              isStaff,
              email: session?.user?.email,
              userId: session?.user?.id,
            },
          })
        );
      }

      if (typeof update === "function") {
        update();
      }

      setSuccess("Profile settings saved successfully!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error("Profile save error:", err);
      setError("Network error while saving profile.");
    } finally {
      setSaving(false);
    }
  }

  const managerEmail = session?.user?.email || (isStaff ? "staff@yourkitchen.com" : "manager@yourkitchen.com");
  const userInitial = ((profileData.name || session?.user?.name || (isStaff ? "S" : "M")).trim().charAt(0) || "M").toUpperCase();

  if (loading) {
    return (
      <div className="p-12 text-center rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span>Profile Settings</span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              {isStaff ? "Staff Account" : "Kitchen Admin"}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Personal identity, contact details, profile photo, and operational preferences.
          </p>
        </div>

        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-orange-500 hover:border-orange-500/40 text-xs font-semibold transition bg-zinc-50 dark:bg-zinc-900/50"
        >
          <span>Full Station Roster & Diagnostics</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* 1. Identity & Avatar Card */}
        <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6 transition-colors">
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Personal Identity</h2>
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Avatar photo and display credentials</p>
            </div>
          </div>

          {/* Avatar Upload Preview */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="relative group shrink-0">
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black overflow-hidden shadow-inner bg-zinc-100 dark:bg-zinc-800 border-2 ${
                  isStaff
                    ? "border-emerald-500/40 text-emerald-500"
                    : "border-orange-500/40 text-orange-500"
                }`}
              >
                {profileData.image ? (
                  <img
                    src={profileData.image}
                    alt={profileData.name || "Profile"}
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  <span>{userInitial}</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-all hover:scale-110 active:scale-95 border-2 border-white dark:border-[#10141f] cursor-pointer"
                title="Change Photo"
              >
                <Camera size={13} />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-zinc-900 dark:text-white">
                  {profileData.name || "Unnamed Operator"}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  {profileData.roleTitle}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Click the camera icon to upload a JPG, PNG or WebP image under 2MB.
              </p>
              {profileData.image && (
                <button
                  type="button"
                  onClick={() => setProfileData((prev) => ({ ...prev, image: "" }))}
                  className="text-xs text-rose-500 hover:text-rose-600 font-semibold cursor-pointer pt-0.5 block"
                >
                  Remove Photo
                </button>
              )}
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Full Name <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                required
                value={profileData.name}
                onChange={(e) => setProfileData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Shivam Kumar"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Account Email <span className="text-zinc-400 font-normal">(Verified)</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  disabled
                  value={managerEmail}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm outline-none cursor-not-allowed pr-10"
                />
                <ShieldCheck className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) => setProfileData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Role / Designation Title
              </label>
              <input
                type="text"
                value={profileData.roleTitle}
                onChange={(e) => setProfileData((prev) => ({ ...prev, roleTitle: e.target.value }))}
                placeholder="Branch Operations Lead"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 outline-none transition"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-orange-500" />
              Operating Kitchen: <strong className="text-zinc-800 dark:text-zinc-200">{restaurantName}</strong>
            </span>
          </div>
        </section>

        {/* 2. Kitchen Sound & Order Chime Preferences */}
        <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5 transition-colors">
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Kitchen Audio Alerts</h2>
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Audible notification sound when new customer tickets arrive</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800/80">
            <div>
              <div className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white">Enable Audio Chimes</div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Play an audible chime when new orders enter the kitchen queue</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={profileData.soundAlerts}
                onChange={(e) => setProfileData((prev) => ({ ...prev, soundAlerts: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {profileData.soundAlerts && (
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Choose Alert Chime Sound
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CHIME_OPTIONS.map((chime) => {
                  const isSelected = selectedChime === chime.id;
                  return (
                    <div
                      key={chime.id}
                      onClick={() => handleChimeChange(chime.id)}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-orange-500/10 dark:bg-orange-500/20 border-orange-500/50 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500/30 font-semibold"
                          : "bg-zinc-50/80 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold truncate">{chime.label}</div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{chime.desc}</div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playChime(chime.id, 1.0);
                        }}
                        className="px-2 py-1 rounded-md text-[10px] font-bold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-orange-500 hover:text-orange-500 transition shrink-0"
                      >
                        Play ▶
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Save Changes Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Profile Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
