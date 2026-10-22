"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Star,
  Search,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  Building,
  User,
  ShoppingBag,
  Filter,
  Send,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  HelpCircle,
  ThumbsUp,
} from "lucide-react";
import { toast } from "../ui/ToastProvider";

const COMPLAINT_LABELS = {
  food_quality: "Food Quality",
  missing_incorrect_items: "Missing / Incorrect Items",
  packaging: "Packaging / Spillage",
  delivery_delay: "Delivery Delay",
  delivery_conduct: "Delivery Conduct",
  payment_refund: "Payment / Billing",
  restaurant_service: "Restaurant Service",
  other: "Other Operational Issue",
};

export default function FeedbackWorkspace({ restaurantName = "" }) {
  const [feedbackList, setFeedbackList] = useState([]);
  const [stats, setStats] = useState({
    totalReviews: 0,
    averageRating: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    unresolvedComplaints: 0,
    totalComplaints: 0,
    awaitingResponse: 0,
    categoryAverages: { foodQuality: null, packaging: null, delivery: null, service: null },
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalMatching: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [complaintFilter, setComplaintFilter] = useState("all");
  const [responseFilter, setResponseFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Selected feedback for detail drawer / response composer
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  // Response Form
  const [responseMessage, setResponseMessage] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);

  // Complaint Workflow
  const [complaintStatus, setComplaintStatus] = useState("open");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [updatingComplaint, setUpdatingComplaint] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadFeedback = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError("");

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
      });

      if (debouncedSearch) params.set("search", debouncedSearch);
      if (ratingFilter !== "all") params.set("rating", ratingFilter);
      if (complaintFilter !== "all") {
        if (complaintFilter === "none") {
          params.set("hasComplaint", "false");
        } else {
          params.set("complaintStatus", complaintFilter);
        }
      }
      if (responseFilter !== "all") {
        params.set("hasResponse", responseFilter === "responded" ? "true" : "false");
      }

      const res = await fetch(`/api/restaurant/feedback?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setFeedbackList(data.feedback || []);
        if (data.stats) setStats(data.stats);
        if (data.pagination) setPagination(data.pagination);

        // Keep selected feedback in sync if open
        if (selectedFeedback) {
          const updated = (data.feedback || []).find((f) => f._id === selectedFeedback._id);
          if (updated) setSelectedFeedback(updated);
        }
      } else {
        setError(data.message || "Failed to load feedback.");
      }
    } catch (err) {
      console.error("Error fetching feedback:", err);
      setError("Network error while loading feedback.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, debouncedSearch, ratingFilter, complaintFilter, responseFilter, selectedFeedback]);

  useEffect(() => {
    loadFeedback();
  }, [currentPage, debouncedSearch, ratingFilter, complaintFilter, responseFilter]);

  const handleOpenDetail = (item) => {
    setSelectedFeedback(item);
    setResponseMessage(item.response?.message || "");
    setComplaintStatus(item.complaint?.status || "open");
    setResolutionNotes(item.complaint?.resolutionNotes || "");
  };

  const handleCloseDetail = () => {
    setSelectedFeedback(null);
    setResponseMessage("");
    setResolutionNotes("");
  };

  const handlePostResponse = async (e) => {
    e.preventDefault();
    if (!selectedFeedback?._id || !responseMessage.trim()) return;

    setSubmittingResponse(true);
    try {
      const res = await fetch(`/api/restaurant/feedback/${selectedFeedback._id}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: responseMessage.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to submit response.");
        return;
      }

      toast.success("Official response posted successfully!");
      // Update local item
      const updatedResponse = data.response;
      setFeedbackList((prev) =>
        prev.map((f) => (f._id === selectedFeedback._id ? { ...f, response: updatedResponse } : f))
      );
      setSelectedFeedback((prev) => (prev ? { ...prev, response: updatedResponse } : prev));
      loadFeedback(true);
    } catch {
      toast.error("Network error while submitting response.");
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleUpdateComplaint = async (newStatus) => {
    if (!selectedFeedback?._id) return;

    setUpdatingComplaint(true);
    try {
      const res = await fetch(`/api/restaurant/feedback/${selectedFeedback._id}/complaint`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          resolutionNotes: resolutionNotes.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to update complaint status.");
        return;
      }

      toast.success(`Complaint marked as ${newStatus.replace("_", " ")}.`);
      const updatedComplaint = data.complaint;
      setFeedbackList((prev) =>
        prev.map((f) => (f._id === selectedFeedback._id ? { ...f, complaint: updatedComplaint } : f))
      );
      setSelectedFeedback((prev) => (prev ? { ...prev, complaint: updatedComplaint } : prev));
      setComplaintStatus(newStatus);
      loadFeedback(true);
    } catch {
      toast.error("Network error while updating complaint.");
    } finally {
      setUpdatingComplaint(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--border-color)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-[var(--brand-accent)] bg-[var(--brand-accent)]/10 px-2 py-0.5 rounded border border-[var(--brand-accent)]/20">
              Reviews & Customer Pulse
            </span>
            {restaurantName && (
              <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1">
                <Building size={12} className="text-[var(--brand-accent)]" />
                {restaurantName}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-main)] tracking-tight">
            Customer Feedback & Complaints
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
            Monitor diner sentiment, reply to verified order reviews, and track complaint resolution.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadFeedback(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] hover:border-[var(--brand-accent)] transition cursor-pointer shadow-sm disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin text-[var(--brand-accent)]" : ""} />
          <span>{refreshing ? "Refreshing..." : "Refresh Feed"}</span>
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Average Rating Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Average Rating
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Star size={18} className="fill-amber-400 text-amber-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-[var(--text-main)] font-mono">
              {stats.totalReviews > 0 ? stats.averageRating : "—"}
            </span>
            <span className="text-xs font-bold text-[var(--text-muted)]">
              {stats.totalReviews > 0 ? "out of 5★" : "No reviews yet"}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Based on {stats.totalReviews} verified completed orders
          </p>
        </div>

        {/* Rating Distribution Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Star Breakdown
            </span>
            <span className="text-[11px] font-mono font-bold text-[var(--text-muted)]">
              {stats.totalReviews} total
            </span>
          </div>
          <div className="space-y-1.5 pt-1">
            {[5, 4, 3, 2, 1].map((s) => {
              const count = stats.ratingDistribution?.[s] || 0;
              const pct = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
              return (
                <div key={s} className="flex items-center gap-2 text-[11px]">
                  <span className="w-4 font-mono font-bold text-[var(--text-muted)]">{s}★</span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--bg-sub)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        s >= 4 ? "bg-emerald-500" : s === 3 ? "bg-amber-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-mono text-[var(--text-muted)]">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Unresolved Complaints Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Active Complaints
            </span>
            <div className={`p-2 rounded-xl ${
              stats.unresolvedComplaints > 0 ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
            }`}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-[var(--text-main)] font-mono">
              {stats.unresolvedComplaints}
            </span>
            <span className="text-xs font-bold text-[var(--text-muted)]">
              requiring action
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            {stats.totalComplaints} total complaints recorded
          </p>
        </div>

        {/* Awaiting Restaurant Response Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Awaiting Reply
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <MessageSquare size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-[var(--text-main)] font-mono">
              {stats.awaitingResponse}
            </span>
            <span className="text-xs font-bold text-[var(--text-muted)]">
              unreplied reviews
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Responding increases diner repeat visits and trust
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by Order ID (#ORD_...), review text, or complaint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-2xl pl-9 pr-4 py-2 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Rating Filter */}
          <select
            value={ratingFilter}
            onChange={(e) => {
              setRatingFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-2xl px-3 py-2 text-xs font-medium text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] cursor-pointer"
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars only</option>
            <option value="4">4 Stars only</option>
            <option value="3">3 Stars only</option>
            <option value="2">2 Stars only</option>
            <option value="1">1 Star only</option>
          </select>

          {/* Complaint Filter */}
          <select
            value={complaintFilter}
            onChange={(e) => {
              setComplaintFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-2xl px-3 py-2 text-xs font-medium text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] cursor-pointer"
          >
            <option value="all">All Complaints</option>
            <option value="open">Open Complaints</option>
            <option value="under_review">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="none">No Complaints</option>
          </select>

          {/* Response Filter */}
          <select
            value={responseFilter}
            onChange={(e) => {
              setResponseFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-2xl px-3 py-2 text-xs font-medium text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] cursor-pointer"
          >
            <option value="all">All Responses</option>
            <option value="pending">Awaiting Reply</option>
            <option value="responded">Responded</option>
          </select>
        </div>
      </div>

      {/* Main Feedback List & Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Feedback Cards */}
        <div className="lg:col-span-2 space-y-4">
          {error && (
            <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-500 flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => loadFeedback()}
                className="underline font-bold hover:opacity-80"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-[var(--brand-accent)] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-[var(--text-muted)]">Loading restaurant feedback...</p>
            </div>
          ) : feedbackList.length === 0 ? (
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-12 text-center space-y-3 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] flex items-center justify-center mx-auto">
                <Star size={26} />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-main)]">No Feedback Records Found</h3>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                {searchQuery || ratingFilter !== "all" || complaintFilter !== "all" || responseFilter !== "all"
                  ? "No reviews match your current filters. Try resetting search or filter options."
                  : "Completed customer orders will appear here once diners leave feedback."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbackList.map((item) => {
                const isSelected = selectedFeedback?._id === item._id;
                const hasComplaint = item.complaint?.hasComplaint;
                const complaintState = item.complaint?.status || "open";
                const isAnon = Boolean(item.isAnonymous);

                return (
                  <div
                    key={item._id}
                    onClick={() => handleOpenDetail(item)}
                    className={`bg-[var(--bg-card)] border rounded-3xl p-5 transition-all duration-200 cursor-pointer shadow-sm space-y-3 hover:border-[var(--brand-accent)]/60 ${
                      isSelected
                        ? "border-[var(--brand-accent)] ring-2 ring-[var(--brand-accent)]/20 shadow-md"
                        : "border-[var(--border-color)]"
                    }`}
                  >
                    {/* Top Row */}
                    <div className="flex items-start justify-between flex-wrap gap-2 pb-2 border-b border-[var(--border-color)]">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Star Rating Badge */}
                        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500 font-mono font-bold text-xs">
                          <Star size={13} className="fill-amber-400 text-amber-400" />
                          <span>{item.rating}/5</span>
                        </div>

                        {/* Order Reference */}
                        <span className="text-xs font-mono font-bold text-[var(--brand-accent)] bg-[var(--brand-accent)]/10 px-2 py-0.5 rounded border border-[var(--brand-accent)]/20">
                          #{item.order?.orderId || item.orderIdString || "ORD"}
                        </span>

                        {/* Customer Identification (Respects Anonymity) */}
                        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 font-medium">
                          {isAnon ? (
                            <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[11px]">
                              <ShieldCheck size={12} /> Anonymous Diner
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[var(--text-main)] font-semibold">
                              <User size={12} className="text-[var(--text-muted)]" />
                              {item.customer?.name || "Customer"}
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Complaint & Response Badges */}
                      <div className="flex items-center gap-2">
                        {hasComplaint && (
                          <span
                            className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                              complaintState === "resolved"
                                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                                : "bg-rose-500/15 text-rose-500 border-rose-500/30"
                            }`}
                          >
                            Complaint: {complaintState.replace("_", " ")}
                          </span>
                        )}

                        {item.response?.message ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/30 flex items-center gap-1">
                            <MessageSquare size={10} /> Replied
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-sub)] text-[var(--text-muted)] border border-[var(--border-color)]">
                            No Reply
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Review Comment Snippet */}
                    {item.comment ? (
                      <p className="text-xs sm:text-sm text-[var(--text-main)] leading-relaxed">
                        “{item.comment}”
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)] italic">
                        No written review comment provided.
                      </p>
                    )}

                    {/* Complaint Preview if active */}
                    {hasComplaint && (
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-[var(--text-main)] space-y-1">
                        <span className="font-bold text-amber-500 flex items-center gap-1">
                          <AlertTriangle size={13} />
                          Issue: {COMPLAINT_LABELS[item.complaint.category] || item.complaint.category}
                        </span>
                        {item.complaint.description && (
                          <p className="text-[11px] text-[var(--text-muted)]">
                            {item.complaint.description}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Restaurant Response Preview */}
                    {item.response?.message && (
                      <div className="p-3 rounded-2xl bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/20 text-xs space-y-1">
                        <span className="font-bold text-[var(--brand-accent)] flex items-center gap-1">
                          <MessageSquare size={12} /> Official Reply ({item.response.respondedBy?.name || "Staff"}):
                        </span>
                        <p className="text-[11px] text-[var(--text-main)]">
                          {item.response.message}
                        </p>
                      </div>
                    )}

                    {/* Order Item Context & Date */}
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-color)]">
                      <span>
                        {item.order?.itemsSummary || (item.order?.itemsCount ? `${item.order.itemsCount} dishes` : "")}
                        {item.order?.totalAmount ? ` • ₹${item.order.totalAmount}` : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl">
              <span className="text-xs text-[var(--text-muted)]">
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalMatching} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!pagination.hasPrevPage}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl bg-[var(--bg-sub)] text-xs font-bold text-[var(--text-main)] hover:bg-[var(--border-color)] transition disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  type="button"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-xl bg-[var(--bg-sub)] text-xs font-bold text-[var(--text-main)] hover:bg-[var(--border-color)] transition disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Feedback Detail & Response Composer Drawer */}
        <div className="lg:col-span-1">
          {selectedFeedback ? (
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-5 sm:p-6 shadow-xl space-y-6 sticky top-24 animate-in fade-in duration-200">
              {/* Drawer Header */}
              <div className="flex items-start justify-between pb-3 border-b border-[var(--border-color)]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[var(--brand-accent)] bg-[var(--brand-accent)]/10 px-2 py-0.5 rounded border border-[var(--brand-accent)]/20">
                      #{selectedFeedback.order?.orderId || selectedFeedback.orderIdString || "ORD"}
                    </span>
                    <div className="inline-flex items-center gap-1 text-amber-500 font-bold font-mono text-xs">
                      <Star size={13} className="fill-amber-400" />
                      <span>{selectedFeedback.rating}/5</span>
                    </div>
                  </div>
                  <h3 className="text-base font-black text-[var(--text-main)] mt-1">
                    Feedback Details
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCloseDetail}
                  className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition cursor-pointer"
                  title="Close details"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Customer Review Summary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Customer:</span>
                  <span className="font-bold text-[var(--text-main)]">
                    {selectedFeedback.isAnonymous ? "Anonymous Diner (Masked)" : (selectedFeedback.customer?.name || "Customer")}
                  </span>
                </div>

                {selectedFeedback.categoryRatings && (
                  <div className="p-3 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] grid grid-cols-2 gap-2 text-xs">
                    {selectedFeedback.categoryRatings.foodQuality && (
                      <div>Food: <strong>{selectedFeedback.categoryRatings.foodQuality}★</strong></div>
                    )}
                    {selectedFeedback.categoryRatings.packaging && (
                      <div>Packaging: <strong>{selectedFeedback.categoryRatings.packaging}★</strong></div>
                    )}
                    {selectedFeedback.categoryRatings.delivery && (
                      <div>Delivery: <strong>{selectedFeedback.categoryRatings.delivery}★</strong></div>
                    )}
                    {selectedFeedback.categoryRatings.service && (
                      <div>Service: <strong>{selectedFeedback.categoryRatings.service}★</strong></div>
                    )}
                  </div>
                )}

                {selectedFeedback.comment && (
                  <div>
                    <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">
                      Customer Review:
                    </label>
                    <p className="text-xs sm:text-sm text-[var(--text-main)] p-3 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] italic">
                      “{selectedFeedback.comment}”
                    </p>
                  </div>
                )}
              </div>

              {/* Complaint Resolution Section */}
              {selectedFeedback.complaint?.hasComplaint && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> Operational Complaint
                    </span>
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">
                      {selectedFeedback.complaint.status?.replace("_", " ")}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-main)]">
                    <strong>Issue:</strong> {COMPLAINT_LABELS[selectedFeedback.complaint.category] || selectedFeedback.complaint.category}
                  </p>

                  {selectedFeedback.complaint.description && (
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      {selectedFeedback.complaint.description}
                    </p>
                  )}

                  <div className="space-y-1.5 pt-2 border-t border-amber-500/20">
                    <label className="text-[11px] font-bold text-[var(--text-muted)] block">
                      Internal Resolution Notes:
                    </label>
                    <textarea
                      rows={2}
                      maxLength={2000}
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Add investigation findings or remedy taken (e.g., refunded, replacement dispatched)..."
                      className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] transition resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {selectedFeedback.complaint.status !== "under_review" && (
                      <button
                        type="button"
                        disabled={updatingComplaint}
                        onClick={() => handleUpdateComplaint("under_review")}
                        className="flex-1 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                      >
                        Mark Under Review
                      </button>
                    )}
                    {selectedFeedback.complaint.status !== "resolved" ? (
                      <button
                        type="button"
                        disabled={updatingComplaint}
                        onClick={() => handleUpdateComplaint("resolved")}
                        className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                      >
                        Resolve Complaint
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={updatingComplaint}
                        onClick={() => handleUpdateComplaint("open")}
                        className="flex-1 py-1.5 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-sub)] text-rose-500 border border-rose-500/30 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                      >
                        Reopen Issue
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Restaurant Response Composer */}
              <form onSubmit={handlePostResponse} className="space-y-3 pt-2 border-t border-[var(--border-color)]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
                    <MessageSquare size={13} className="text-[var(--brand-accent)]" />
                    {selectedFeedback.response?.message ? "Edit Official Response" : "Post Restaurant Response"}
                  </label>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    {responseMessage.length}/2000
                  </span>
                </div>

                <textarea
                  rows={4}
                  maxLength={2000}
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  placeholder="Thank the diner or address their specific dining experience directly..."
                  className="w-full bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-2xl p-3 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] transition resize-none"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={submittingResponse || !responseMessage.trim()}
                    className="px-4 py-2 rounded-xl bg-[var(--brand-accent)] hover:opacity-90 text-white font-bold text-xs shadow-md shadow-[var(--brand-accent)]/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send size={13} />
                    <span>{submittingResponse ? "Posting..." : selectedFeedback.response?.message ? "Update Response" : "Post Response"}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-8 text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-[var(--bg-sub)] text-[var(--text-muted)] flex items-center justify-center mx-auto">
                <MessageSquare size={22} />
              </div>
              <h4 className="text-sm font-bold text-[var(--text-main)]">No Review Selected</h4>
              <p className="text-xs text-[var(--text-muted)]">
                Click any feedback card on the left to post an official reply, inspect ratings, or update complaint resolutions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
