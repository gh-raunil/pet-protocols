"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Shield,
  Key,
  Phone,
  Mail,
  Search,
  Check,
  ChefHat,
  Receipt,
  Briefcase,
  Truck,
  Package,
  Headphones,
} from "lucide-react";

export const AVAILABLE_ROLES = [
  {
    id: "Kitchen",
    label: "Kitchen",
    icon: ChefHat,
    badge: "🍳 Kitchen",
    desc: "Orders KDS view, ticket cooking & preparation readiness",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    activeColor: "bg-amber-500 text-white border-amber-500 shadow-amber-500/20 shadow-sm",
  },
  {
    id: "Cashier",
    label: "Cashier",
    icon: Receipt,
    badge: "💵 Cashier",
    desc: "Front counter billing, KDS tickets & order settlement",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    activeColor: "bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/20 shadow-sm",
  },
  {
    id: "Manager",
    label: "Manager",
    icon: Briefcase,
    badge: "👔 Manager",
    desc: "Full shift operations, sales metrics, menu items & orders",
    color: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    activeColor: "bg-indigo-500 text-white border-indigo-500 shadow-indigo-500/20 shadow-sm",
  },
  {
    id: "Delivery",
    label: "Delivery",
    icon: Truck,
    badge: "🛵 Delivery",
    desc: "Order dispatch status, handover & transit tracking",
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    activeColor: "bg-blue-500 text-white border-blue-500 shadow-blue-500/20 shadow-sm",
  },
  {
    id: "Inventory",
    label: "Inventory",
    icon: Package,
    badge: "📦 Inventory",
    desc: "Menu stock check, item availability toggle & ingredients",
    color: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    activeColor: "bg-purple-500 text-white border-purple-500 shadow-purple-500/20 shadow-sm",
  },
  {
    id: "Support",
    label: "Support",
    icon: Headphones,
    badge: "🎧 Support",
    desc: "Customer inquiries, order status lookup & live assistance",
    color: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    activeColor: "bg-rose-500 text-white border-rose-500 shadow-rose-500/20 shadow-sm",
  },
];

export default function StaffSection() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    staffRoles: ["Kitchen"],
    password: "",
    status: "active",
  });

  async function loadStaff() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/restaurant/staff");
      const data = await res.json();
      if (data.success && Array.isArray(data.staff)) {
        setStaff(data.staff);
      } else {
        setError(data.message || data.error || "Failed to load staff list.");
      }
    } catch (err) {
      console.error("Load staff error:", err);
      setError("Network error while loading staff.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  function handleOpenCreate() {
    setEditingStaff(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      staffRoles: ["Kitchen"],
      password: "TempPassword@123",
      status: "active",
    });
    setModalOpen(true);
  }

  function handleOpenEdit(member) {
    setEditingStaff(member);
    const existingRoles =
      Array.isArray(member.staffRoles) && member.staffRoles.length > 0
        ? member.staffRoles
        : member.staffRole
        ? member.staffRole.split(",").map((s) => s.trim()).filter(Boolean)
        : ["Kitchen"];

    setFormData({
      name: member.name || "",
      email: member.email || "",
      phone: member.phone || "",
      staffRoles: existingRoles,
      password: "",
      status: member.status || "active",
    });
    setModalOpen(true);
  }

  function handleToggleRole(roleId) {
    setFormData((prev) => {
      const exists = prev.staffRoles.includes(roleId);
      let updated;
      if (exists) {
        if (prev.staffRoles.length === 1) return prev; // Maintain at least 1 role
        updated = prev.staffRoles.filter((r) => r !== roleId);
      } else {
        updated = [...prev.staffRoles, roleId];
      }
      return { ...prev, staffRoles: updated };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!formData.staffRoles || formData.staffRoles.length === 0) {
      setError("Please select at least one assigned role for this staff member.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const isEdit = Boolean(editingStaff?._id);
      const url = isEdit
        ? `/api/restaurant/staff/${editingStaff._id}`
        : "/api/restaurant/staff";
      const method = isEdit ? "PUT" : "POST";

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        staffRoles: formData.staffRoles,
        staffRole: formData.staffRoles.join(", "),
        status: formData.status,
      };

      if (!isEdit || (formData.password && formData.password.trim().length >= 6)) {
        payload.password = formData.password.trim();
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setSuccess(data.message || (isEdit ? "Staff member updated!" : "Staff member added!"));
        setModalOpen(false);
        loadStaff();
      } else {
        setError(data.message || data.error || "Failed to save staff member.");
      }
    } catch (err) {
      console.error("Save staff error:", err);
      setError(err.message || "Failed to save staff member.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(member) {
    const newStatus = member.status === "active" ? "inactive" : "active";
    try {
      const res = await fetch(`/api/restaurant/staff/${member._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setStaff((prev) =>
          prev.map((s) => (s._id === member._id ? { ...s, status: newStatus } : s))
        );
      }
    } catch (err) {
      console.error("Toggle status error:", err);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to remove this staff member? They will no longer be able to log in.")) return;
    try {
      const res = await fetch(`/api/restaurant/staff/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("Staff member removed successfully.");
        setStaff((prev) => prev.filter((s) => s._id !== id));
      } else {
        setError(data.message || "Failed to remove staff member.");
      }
    } catch (err) {
      console.error("Delete staff error:", err);
      setError("Failed to remove staff member.");
    }
  }

  // Filter staff by search and role
  const filteredStaff = useMemo(() => {
    return staff.filter((member) => {
      const matchQuery =
        !searchQuery ||
        member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.phone?.toLowerCase().includes(searchQuery.toLowerCase());

      const memberRoles =
        Array.isArray(member.staffRoles) && member.staffRoles.length > 0
          ? member.staffRoles
          : member.staffRole
          ? member.staffRole.split(",").map((s) => s.trim())
          : ["Staff"];

      const matchRole =
        roleFilter === "all" ||
        (roleFilter === "admin" && member.role === "restaurant_admin") ||
        memberRoles.includes(roleFilter);

      return matchQuery && matchRole;
    });
  }, [staff, searchQuery, roleFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Restaurant Staff & Team Roles
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              {staff.length} Active Accounts
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Empower your floor, kitchen, and cashier team. Assign multiple operational roles with scoped permissions.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm font-semibold shadow-md shadow-orange-500/25 transition-all w-fit cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Add Staff Member
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Role Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {AVAILABLE_ROLES.map((role) => {
          const count = staff.filter((m) => {
            const roles = Array.isArray(m.staffRoles) && m.staffRoles.length > 0
              ? m.staffRoles
              : m.staffRole ? m.staffRole.split(",").map(s => s.trim()) : [];
            return roles.includes(role.id);
          }).length;
          const Icon = role.icon;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => setRoleFilter(roleFilter === role.id ? "all" : role.id)}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                roleFilter === role.id
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 shadow-md scale-[1.02]"
                  : "bg-white dark:bg-[#10141f] border-zinc-200/80 dark:border-zinc-800/80 hover:border-orange-500/40 text-zinc-800 dark:text-zinc-200"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Icon className={`w-4 h-4 ${roleFilter === role.id ? "text-orange-400 dark:text-orange-500" : "text-zinc-500"}`} />
                <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded-full ${roleFilter === role.id ? "bg-white/20 dark:bg-black/20" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                  {count}
                </span>
              </div>
              <div className="text-xs font-bold truncate">{role.label}</div>
              <div className="text-[10px] opacity-70 truncate">{role.desc.split(",")[0]}</div>
            </button>
          );
        })}
      </div>

      {/* Staff List & Filter Card */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-sm space-y-4 transition-colors">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 text-xs font-semibold text-zinc-800 dark:text-zinc-200 outline-none focus:border-orange-500 cursor-pointer transition-all"
            >
              <option value="all">All Roles ({staff.length})</option>
              <option value="admin">Lead Admins</option>
              {AVAILABLE_ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content list */}
        {loading ? (
          <div className="py-14 text-center text-zinc-500 text-sm">Loading staff members...</div>
        ) : filteredStaff.length === 0 ? (
          <div className="py-14 text-center space-y-3">
            <Users className="w-9 h-9 text-zinc-400 mx-auto" />
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {searchQuery || roleFilter !== "all"
                ? "No team members matched your search filter."
                : "No staff members added yet."}
            </p>
            <button
              onClick={handleOpenCreate}
              type="button"
              className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
            >
              + Add your first kitchen or floor staff
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredStaff.map((member) => {
              const isLeadAdmin = member.role === "restaurant_admin" || member.role === "admin";
              const roles =
                Array.isArray(member.staffRoles) && member.staffRoles.length > 0
                  ? member.staffRoles
                  : member.staffRole
                  ? member.staffRole.split(",").map((s) => s.trim()).filter(Boolean)
                  : ["Staff"];

              return (
                <div
                  key={member._id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-zinc-50/70 dark:bg-[#151926] border border-zinc-200/80 dark:border-white/5 hover:border-orange-500/40 hover:bg-white dark:hover:bg-[#171c2c] transition-all shadow-xs flex flex-col justify-between gap-3 group"
                >
                  {/* Top: Avatar, Name, Email, Status */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500/20 to-amber-500/20 text-orange-600 dark:text-orange-400 font-black text-sm flex items-center justify-center shrink-0 border border-orange-500/30 ring-2 ring-orange-500/10 shadow-xs">
                        {member.name?.charAt(0)?.toUpperCase() || "S"}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-extrabold text-zinc-900 dark:text-white truncate">
                            {member.name}
                          </h4>
                          {isLeadAdmin && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                              <Shield className="w-3 h-3" /> Lead Admin
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          <Mail className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Pill on Top Right */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-extrabold shrink-0 border ${
                        member.status === "active"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-600"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          member.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                        }`}
                      />
                      <span>{member.status === "active" ? "Active" : "Inactive"}</span>
                    </span>
                  </div>

                  {/* Middle: Badges for non-admin */}
                  {!isLeadAdmin && roles.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pl-0 sm:pl-[52px]">
                      {roles.map((rId) => {
                        const meta = AVAILABLE_ROLES.find((r) => r.id === rId);
                        const RoleIcon = meta?.icon || Briefcase;
                        return (
                          <span
                            key={rId}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border shadow-2xs ${
                              meta?.color ||
                              "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                            }`}
                          >
                            <RoleIcon className="w-3 h-3 shrink-0" />
                            <span>{meta?.label || rId}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Bottom: Contact Info & Action Buttons */}
                  <div className="pt-2.5 border-t border-zinc-200/70 dark:border-white/5 flex items-center justify-between gap-2 text-xs">
                    {/* Phone on left */}
                    <div className="min-w-0">
                      {member.phone ? (
                        <a
                          href={`tel:${member.phone}`}
                          className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 hover:text-orange-600 dark:hover:text-orange-400 font-medium transition"
                        >
                          <Phone className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span className="font-mono text-xs truncate">{member.phone}</span>
                        </a>
                      ) : (
                        <span className="text-zinc-400 text-[11px]">No contact number</span>
                      )}
                    </div>

                    {/* Actions on right */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isLeadAdmin && (
                        <button
                          onClick={() => handleToggleStatus(member)}
                          type="button"
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 transition cursor-pointer"
                        >
                          {member.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenEdit(member)}
                        type="button"
                        className="p-1.5 rounded-lg bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
                        title="Edit Staff Member"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {!isLeadAdmin && (
                        <button
                          onClick={() => handleDelete(member._id)}
                          type="button"
                          className="p-1.5 rounded-lg bg-zinc-100 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/20 text-zinc-400 hover:text-red-500 transition cursor-pointer"
                          title="Remove Staff"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add / Edit Staff Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#10141f] border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-[#10141f]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                  {editingStaff ? <Edit2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
                    {editingStaff ? "Edit Staff Member" : "Add Staff Member"}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Assign multi-station duties and set login credentials.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white cursor-pointer p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Staff Full Name <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Email Address <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      disabled={Boolean(editingStaff)}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="staff@restaurant.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 disabled:opacity-50 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 00000"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 outline-none"
                    />
                  </div>
                </div>

                {/* Multiple Role Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Assigned Operational Roles <span className="text-orange-500">*</span>
                    </label>
                    <span className="text-[11px] text-zinc-500 font-medium">
                      Select one or multiple duties
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {AVAILABLE_ROLES.map((role) => {
                      const isSelected = formData.staffRoles.includes(role.id);
                      const Icon = role.icon;
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => handleToggleRole(role.id)}
                          className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                            isSelected
                              ? "bg-orange-500/10 border-orange-500 dark:bg-orange-500/15"
                              : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/80 hover:border-zinc-400"
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border ${
                              isSelected
                                ? "bg-orange-500 border-orange-500 text-white"
                                : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Icon className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                              <span className="text-xs font-bold text-zinc-900 dark:text-white">
                                {role.label}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">
                              {role.desc}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Password Configuration */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {editingStaff ? "Reset Login Password (Optional)" : "Initial Password"}
                  </label>
                  <div className="relative">
                    <Key className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingStaff ? "Leave blank to keep unchanged" : "TempPassword@123"}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs sm:text-sm font-mono outline-none focus:border-orange-500"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Staff will use this password to sign in at the Admin Portal.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 px-5 sm:px-6 py-3.5 border-t border-zinc-100 dark:border-zinc-800 shrink-0 bg-zinc-50/90 dark:bg-[#0c0e17]/90 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-md shadow-orange-500/25 transition-all cursor-pointer"
                >
                  {submitting ? "Saving..." : editingStaff ? "Update Staff" : "Add Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
