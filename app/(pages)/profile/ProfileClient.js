"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProfileSkeleton } from "@/app/components/ui/Skeleton";

export default function ProfileClient() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orders, setOrders] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);

  // Redirect if not logged in
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/profile");
    }
  }, [status, router]);

  // Set name from session
  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name);
    }
  }, [session]);

  // Fetch orders for stats
  useEffect(() => {
    if (!session) return;

    async function fetchOrders() {
      try {
        const res = await fetch("/api/orders");
        const data = await res.json();

        const orderList = data.orders || [];

        setOrders(orderList);

        setTotalSpent(
          orderList.reduce(
            (sum, o) => sum + o.totalAmount,
            0
          )
        );
      } catch (err) {
        console.error(err);
      }
    }

    fetchOrders();
  }, [session]);

  const handleSave = async () => {
    if (!name.trim()) return;

    setSaving(true);

    try {
      const res = await fetch("/api/user/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (data.success) {
        await update({ name });

        setSuccess(true);

        setTimeout(() => {
          setSuccess(false);
        }, 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") {
    return <ProfileSkeleton />;
  }

  return (
    <main className="min-h-screen pt-28 pb-16 px-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="mb-8">

        <h1 className="text-4xl font-bold">
          My <span className="text-brand-orange">Profile</span>
        </h1>

        <p className="text-brand-muted mt-1">
          Manage your account details
        </p>

      </div>

      {/* Avatar Card */}
      <div className="
        bg-brand-card
        border border-brand-border
        rounded-2xl
        p-8
        mb-6
        text-center
      ">

        <div className="relative w-24 h-24 mx-auto mb-4">

          <img
            src={session?.user?.image || "/default-avatar.png"}
            alt={session?.user?.name}
            className="
              w-24
              h-24
              rounded-full
              object-cover
              border-4 border-brand-orange
            "
          />

          <span className="
            absolute
            bottom-0
            right-0
            w-6
            h-6
            bg-green-500
            rounded-full
            border-2 border-brand-card
          " />

        </div>

        <h2 className="text-2xl font-bold text-white">
          {session?.user?.name}
        </h2>

        <p className="text-brand-muted mt-1">
          {session?.user?.email}
        </p>

        <span className="
          inline-block
          mt-3
          text-xs
          bg-brand-orange/20
          text-brand-orange
          px-3
          py-1
          rounded-full
        ">
          {session?.user?.role === "admin"
            ? "👑 Admin"
            : "🍔 Food Lover"}
        </span>

      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">

        <div className="
          bg-brand-card
          border border-brand-border
          rounded-2xl
          p-5
          text-center
        ">

          <p className="text-3xl font-bold text-brand-orange">
            {orders.length}
          </p>

          <p className="text-brand-muted text-sm mt-1">
            Total Orders
          </p>

        </div>

        <div className="
          bg-brand-card
          border border-brand-border
          rounded-2xl
          p-5
          text-center
        ">

          <p className="text-3xl font-bold text-brand-orange">
            ₹{totalSpent}
          </p>

          <p className="text-brand-muted text-sm mt-1">
            Total Spent
          </p>

        </div>

      </div>

      {/* Edit Profile */}
      <div className="
        bg-brand-card
        border border-brand-border
        rounded-2xl
        p-6
        mb-6
      ">

        <h3 className="text-lg font-bold mb-5">
          ✏️ Edit Profile
        </h3>

        <div className="
          bg-brand-card
          border border-brand-border
          rounded-2xl
          p-6
          mb-6
        ">

          <div className="flex justify-between items-center">

            <div>

              <h3 className="font-bold text-white">
                Account Details
              </h3>

              <p className="text-brand-muted text-sm mt-1">
                Update your name and profile picture
              </p>

            </div>

            <Link
              href="/profile/edit"
              className="
                bg-brand-orange
                text-white
                px-4
                py-2
                rounded-full
                text-sm
                font-semibold
                hover:opacity-90
                transition
              "
            >
              Edit ✏️
            </Link>

          </div>

        </div>

      </div>

      {/* Quick Links */}
      <div className="
        bg-brand-card
        border border-brand-border
        rounded-2xl
        overflow-hidden
        mb-6
      ">

        <h3 className="text-lg font-bold px-6 pt-5 pb-3">
          🔗 Quick Links
        </h3>

        <Link
          href="/orders"
          className="
            flex items-center justify-between
            px-6 py-4
            border-t border-brand-border
            hover:bg-brand-border
            transition
          "
        >
          <span className="text-sm text-white">
            📦 My Orders
          </span>

          <span className="text-brand-muted text-xs">
            →
          </span>
        </Link>

        <Link
          href="/menu"
          className="
            flex items-center justify-between
            px-6 py-4
            border-t border-brand-border
            hover:bg-brand-border
            transition
          "
        >
          <span className="text-sm text-white">
            🍔 Browse Menu
          </span>

          <span className="text-brand-muted text-xs">
            →
          </span>
        </Link>

      </div>

      {/* Logout */}
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="
          w-full
          py-3
          rounded-full
          border border-red-500/30
          text-red-400
          hover:bg-red-500/10
          transition
          font-semibold
          text-sm
        "
      >
        🚪 Logout
      </button>

    </main>
  );
}