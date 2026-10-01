"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, ArrowLeft } from "lucide-react";
import { toast } from "@/components/ui/ToastProvider";

export default function EditProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "");
      setPhone(session.user.phone || "");
      setPreviewImage(session.user.image || null);
    }
  }, [session]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    setImageFile(file);
    setError("");

    const reader = new FileReader();
    reader.onload = (e) => setPreviewImage(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Full name is required");
      return;
    }

    if (phone && phone.length !== 10) {
      setError("Phone number must be exactly 10 digits");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let imageUrl = session?.user?.image;

      if (imageFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append("image", imageFile);

        const uploadRes = await fetch("/api/user/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();

        if (!uploadData.success) {
          setError("Image upload failed. Please try again.");
          setSaving(false);
          setUploading(false);
          return;
        }

        imageUrl = uploadData.imageUrl;
        setUploading(false);
      }

      const res = await fetch("/api/user/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          image: imageUrl,
        }),
      });

      const data = await res.json();

      if (data.success) {
        if (update) {
          await update({
            name: data.user?.name || name.trim(),
            image: data.user?.image || imageUrl,
          });
        }
        setSuccess(true);
        toast.success("Profile saved successfully!");
        setTimeout(() => {
          router.push("/profile");
        }, 1200);
      } else {
        setError(data.message || "Failed to update profile");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)] text-sm animate-pulse">Loading...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 max-w-lg mx-auto text-[var(--text-main)] transition-colors">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/profile"
          className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black">
            Edit <span className="text-[var(--brand-accent)]">Profile</span>
          </h1>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">
            Update your personal contact information
          </p>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        {/* Avatar Upload */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-[var(--bg-sub)] border-4 border-[var(--brand-accent)] flex items-center justify-center text-3xl font-black text-[var(--brand-accent)]">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{name?.charAt(0) || "U"}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 bg-[var(--brand-accent)] rounded-full flex items-center justify-center hover:opacity-90 transition border-2 border-[var(--bg-card)] text-white shadow"
              aria-label="Change photo"
            >
              <Camera size={14} />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[var(--brand-accent)] text-xs font-semibold hover:underline transition"
          >
            {imageFile ? "Image selected — click to change" : "Upload new profile photo"}
          </button>
          {uploading && (
            <p className="text-[var(--text-muted)] text-xs animate-pulse">
              Uploading picture...
            </p>
          )}
        </div>

        <div className="border-t border-[var(--border-color)]" />

        {/* Name */}
        <div>
          <label className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-wider mb-1.5 block">
            Full Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="w-full bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-main)] text-sm focus:border-[var(--brand-accent)] transition shadow-sm"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-wider mb-1.5 block">
            Phone Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit phone number"
            className="w-full bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-main)] text-sm focus:border-[var(--brand-accent)] transition shadow-sm font-mono"
          />
        </div>

        {/* Email */}
        <div>
          <label className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-wider mb-1.5 block">
            Email (read-only)
          </label>
          <input
            type="email"
            value={session?.user?.email || ""}
            disabled
            className="w-full bg-[var(--bg-sub)]/50 border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-muted)] text-sm font-mono cursor-not-allowed opacity-60"
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-500/15 border border-red-500/30 text-red-500 text-xs px-4 py-3 rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-2xl bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider transition shadow-md shadow-[var(--brand-accent)]/20 cursor-pointer disabled:opacity-50"
        >
          {saving ? "Saving..." : success ? "✓ Saved!" : "Save Changes"}
        </button>
      </div>
    </main>
  );
}