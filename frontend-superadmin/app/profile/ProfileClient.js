"use client";

import { useEffect, useState, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  ShieldCheck,
  ArrowLeft,
  Building2,
  Users,
  ShoppingBag,
  LogOut,
  RefreshCw,
  Mail,
  User,
  Shield,
  Activity,
  Camera,
  Trash2,
} from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function SuperadminProfileClient() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageActionLoading, setImageActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type?.toLowerCase())) {
      toast.error("Please upload a JPG, PNG, or WebP image");
      return;
    }

    try {
      setImageActionLoading(true);
      toast.loading("Uploading photo...", { id: "superadmin-avatar" });

      const formData = new FormData();
      formData.append("image", file);

      const uploadRes = await fetch("/api/user/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.success || !uploadData.imageUrl) {
        toast.error(uploadData.message || "Failed to upload image", { id: "superadmin-avatar" });
        return;
      }

      const updateRes = await fetch("/api/user/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: uploadData.imageUrl }),
      });

      const updateResult = await updateRes.json();
      if (!updateResult.success) {
        toast.error(updateResult.message || "Failed to update profile", { id: "superadmin-avatar" });
        return;
      }

      if (update) {
        await update({ image: uploadData.imageUrl });
      }

      toast.success("Profile photo updated!", { id: "superadmin-avatar" });
    } catch (err) {
      console.error("Avatar upload failed:", err);
      toast.error("Failed to upload profile photo", { id: "superadmin-avatar" });
    } finally {
      setImageActionLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteImage = async () => {
    try {
      setImageActionLoading(true);
      toast.loading("Removing photo...", { id: "superadmin-avatar" });

      const res = await fetch("/api/user/update", {
        method: "DELETE",
      });

      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || "Failed to remove image", { id: "superadmin-avatar" });
        return;
      }

      if (update) {
        await update({ image: null });
      }

      setShowDeleteConfirm(false);
      toast.success("Profile photo removed!", { id: "superadmin-avatar" });
    } catch (err) {
      console.error("Avatar deletion failed:", err);
      toast.error("Failed to remove profile photo", { id: "superadmin-avatar" });
    } finally {
      setImageActionLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    async function fetchStats() {
      try {
        const res = await fetch("/api/superadmin/stats");
        const data = await res.json();
        if (data.success) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error("Failed to load platform stats", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [session]);

  function getInitials(name) {
    if (!name) return "SA";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-[#070a10]">
        <div className="flex flex-col items-center gap-3 text-indigo-600 dark:text-indigo-400">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading Profile...</p>
        </div>
      </main>
    );
  }

  const superName = session?.user?.name || "Super Admin";
  const superEmail = session?.user?.email || "Configured Account";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070a10] text-slate-800 dark:text-slate-200 transition-colors">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        {/* ── TOP ACTION BAR ─────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Platform Overview</span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-600 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-500/20 transition"
              type="button"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>

        {/* ── PROFILE HEADER CARD ─────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="relative group w-fit">
                <div
                  onClick={() => !imageActionLoading && fileInputRef.current?.click()}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-md shadow-indigo-200 dark:shadow-indigo-950 shrink-0 overflow-hidden cursor-pointer relative"
                  title="Click to update photo"
                >
                  {session?.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt={superName}
                      width={80}
                      height={80}
                      unoptimized={session.user.image.startsWith("data:")}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <span>{getInitials(superName)}</span>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-0.5 backdrop-blur-[1px]">
                    <Camera size={16} className="drop-shadow" />
                    <span className="text-[9px] font-bold tracking-wider uppercase">Change</span>
                  </div>

                  {imageActionLoading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white backdrop-blur-[2px]">
                      <RefreshCw size={18} className="animate-spin text-indigo-400" />
                    </div>
                  )}
                </div>

                {/* Camera badge */}
                <button
                  type="button"
                  onClick={() => !imageActionLoading && fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-indigo-600 hover:bg-indigo-700 border-2 border-white dark:border-slate-900 rounded-full flex items-center justify-center text-white shadow transition cursor-pointer"
                  title="Change photo"
                >
                  <Camera size={11} />
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Super Admin
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                    Active
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {superName}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {superEmail}
                </p>

                {/* Profile Photo Controls */}
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imageActionLoading}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 text-xs font-semibold border border-indigo-200 dark:border-indigo-500/20 transition cursor-pointer disabled:opacity-50"
                  >
                    <Camera size={12} />
                    <span>{session?.user?.image ? "Update Photo" : "Upload Photo"}</span>
                  </button>
                  {session?.user?.image && (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={imageActionLoading}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-200 dark:border-rose-500/20 transition cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                      <span>Remove Photo</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
            >
              <span>Manage Restaurants</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* ── PLATFORM METRICS SUMMARY ─────────────────────────────── */}
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Platform Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Restaurants */}
            <div className="bg-white dark:bg-slate-900/60 rounded-xl p-5 border border-slate-200/90 dark:border-slate-800/90 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Restaurants
                </span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats?.totalRestaurants ?? 0}
                </span>
              </div>
            </div>

            {/* Total Admins */}
            <div className="bg-white dark:bg-slate-900/60 rounded-xl p-5 border border-slate-200/90 dark:border-slate-800/90 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Admins
                </span>
                <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats?.totalAdmins ?? 0}
                </span>
              </div>
            </div>

            {/* Orders */}
            <div className="bg-white dark:bg-slate-900/60 rounded-xl p-5 border border-slate-200/90 dark:border-slate-800/90 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Orders
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats?.totalOrders ?? 0}
                </span>
              </div>
            </div>

            {/* Revenue */}
            <div className="bg-white dark:bg-slate-900/60 rounded-xl p-5 border border-slate-200/90 dark:border-slate-800/90 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Revenue
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                  ₹
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900 dark:text-emerald-400">
                  ₹{(stats?.totalRevenue ?? 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── ACCOUNT DETAILS ─────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-6 sm:p-7 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Account Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/60">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                <User className="w-3.5 h-3.5" />
                <span>Full Name</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {superName}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/60">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                <Mail className="w-3.5 h-3.5" />
                <span>Email Address</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white font-mono">
                {superEmail}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/60">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                <Shield className="w-3.5 h-3.5" />
                <span>Role</span>
              </div>
              <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                Super Admin
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/60">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                <Activity className="w-3.5 h-3.5" />
                <span>Status</span>
              </div>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Active & Verified
              </p>
            </div>
          </div>
        </div>

        {/* ── DELETE PHOTO CONFIRMATION MODAL ────────────────────────── */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/25 text-rose-500 flex items-center justify-center mx-auto">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Profile Photo?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Are you sure you want to remove your profile photo? Your initials will be displayed instead.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={imageActionLoading}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteImage}
                  disabled={imageActionLoading}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
                >
                  {imageActionLoading ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span>Remove Photo</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
