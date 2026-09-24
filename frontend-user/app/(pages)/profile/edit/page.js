'use client'
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Camera } from 'lucide-react'

export default function EditProfilePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const fileInputRef = useRef(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [previewImage, setPreviewImage] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status])

  // Populate fields from session
  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || '')
      setPhone(session.user.phone || '')
      setPreviewImage(session.user.image || null)
    }
  }, [session])

  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    setImageFile(file)
    setError('')

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => setPreviewImage(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    if (phone && phone.length !== 10) {
      setError('Phone number must be 10 digits')
      return
    }

    setSaving(true)
    setError('')

    try {
      let imageUrl = session?.user?.image

      // Step 1 — Upload image if changed
      if (imageFile) {
        setUploading(true)
        const formData = new FormData()
        formData.append('image', imageFile)

        const uploadRes = await fetch('/api/user/upload', {
          method: 'POST',
          body: formData,
        })

        const uploadData = await uploadRes.json()

        if (!uploadData.success) {
          setError('Image upload failed. Please try again.')
          setSaving(false)
          setUploading(false)
          return
        }

        imageUrl = uploadData.imageUrl
        setUploading(false)
      }

      // Step 2 — Update user profile
      const res = await fetch('/api/user/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          image: imageUrl,
        }),
      })

      const data = await res.json()

      if (data.success) {
        // Update session with new data
        await update({
          name: data.user.name,
          image: data.user.image,
        })
        setSuccess(true)
        setTimeout(() => {
          router.push('/profile')
        }, 1500)
      } else {
        setError(data.message || 'Failed to update profile')
      }

    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-brand-muted text-xl animate-pulse">Loading...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen pt-28 pb-16 px-6 max-w-lg mx-auto">

      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/profile"
          className="text-brand-muted hover:text-white transition text-sm">
          ← Back
        </Link>
        <div>
          <h1 className="text-3xl font-bold">
            Edit <span className="text-brand-orange">Profile</span>
          </h1>
          <p className="text-brand-muted text-sm mt-0.5">
            Update your personal information
          </p>
        </div>
      </div>

      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 space-y-6">

        {/* Avatar Upload */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <img
              src={previewImage || '/default-avatar.png'}
              alt="Profile"
              className="w-28 h-28 rounded-full object-cover border-4 border-brand-orange"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-9 h-9 bg-brand-orange rounded-full flex items-center justify-center hover:opacity-90 transition border-2 border-brand-card">
              <Camera size={16} className="text-white" />
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
            onClick={() => fileInputRef.current?.click()}
            className="text-brand-orange text-sm hover:underline transition">
            {imageFile ? '✅ Image selected — click to change' : 'Change profile picture'}
          </button>
          {uploading && (
            <p className="text-brand-muted text-xs animate-pulse">
              Uploading image...
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-brand-border" />

        {/* Name */}
        <div>
          <label className="text-brand-muted text-sm mb-1.5 block">
            Full Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-white placeholder-brand-muted outline-none focus:border-brand-orange transition"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="text-brand-muted text-sm mb-1.5 block">
            Phone Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit phone number"
            className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-white placeholder-brand-muted outline-none focus:border-brand-orange transition"
          />
        </div>

        {/* Email — disabled */}
        <div>
          <label className="text-brand-muted text-sm mb-1.5 block">
            Email <span className="text-xs text-brand-muted">(cannot be changed)</span>
          </label>
          <input
            type="email"
            value={session?.user?.email || ''}
            disabled
            className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-brand-muted outline-none cursor-not-allowed opacity-50"
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
            ❌ {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="bg-green-500/20 border border-green-500/30 text-green-400 text-sm px-4 py-3 rounded-xl">
            ✅ Profile updated! Redirecting...
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <Link
            href="/profile"
            className="flex-1 py-3 rounded-full border border-brand-border text-brand-muted text-sm font-semibold text-center hover:bg-brand-border transition">
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 py-3 rounded-full text-sm font-semibold transition
              ${saving
                ? 'bg-brand-border text-brand-muted cursor-not-allowed'
                : 'bg-brand-orange text-white hover:opacity-90'
              }`}>
            {saving ? (uploading ? 'Uploading...' : 'Saving...') : 'Save Changes'}
          </button>
        </div>

      </div>
    </main>
  )
}