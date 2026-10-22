"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Star,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building,
  MessageSquare,
  ThumbsUp,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { toast } from "@/components/ui/ToastProvider";

const COMPLAINT_CATEGORIES = [
  { value: "food_quality", label: "Food Quality Issue" },
  { value: "missing_incorrect_items", label: "Missing or Incorrect Items" },
  { value: "packaging", label: "Packaging or Spillage" },
  { value: "delivery_delay", label: "Excessive Delivery Delay" },
  { value: "delivery_conduct", label: "Delivery Staff Conduct" },
  { value: "payment_refund", label: "Payment or Billing Issue" },
  { value: "restaurant_service", label: "Restaurant Service" },
  { value: "other", label: "Other Operational Issue" },
];

function InteractiveStarRating({
  value,
  onChange,
  label = "Rating",
  size = 28,
  readOnly = false,
}) {
  const [hoverVal, setHoverVal] = useState(0);

  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = (hoverVal || value) >= star;
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange(star)}
            onMouseEnter={() => !readOnly && setHoverVal(star)}
            onMouseLeave={() => !readOnly && setHoverVal(0)}
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} of 5 stars`}
            className={`p-1 rounded-lg transition-transform focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] cursor-pointer ${
              readOnly ? "cursor-default" : "hover:scale-110 active:scale-95"
            }`}
          >
            <Star
              size={size}
              className={`transition-colors duration-150 ${
                isFilled
                  ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                  : "fill-transparent text-[var(--text-muted)] opacity-40"
              }`}
            />
          </button>
        );
      })}
      {value > 0 && (
        <span className="ml-2 text-xs font-bold text-[var(--text-main)] font-mono">
          {value}/5
        </span>
      )}
    </div>
  );
}

export default function FeedbackModal({
  order,
  isOpen,
  onClose,
  onFeedbackSubmitted,
}) {
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [existingFeedback, setExistingFeedback] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [rating, setRating] = useState(5);
  const [foodQuality, setFoodQuality] = useState(null);
  const [packaging, setPackaging] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [service, setService] = useState(null);
  const [comment, setComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Complaint section
  const [hasComplaint, setHasComplaint] = useState(false);
  const [complaintCategory, setComplaintCategory] = useState("food_quality");
  const [complaintDescription, setComplaintDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const modalRef = useRef(null);

  const fetchExistingFeedback = useCallback(async () => {
    if (!order?._id && !order?.orderId) return;
    setLoadingInitial(true);
    setErrorMessage("");
    try {
      const orderParam = order.orderId || order._id;
      const res = await fetch(`/api/orders/${orderParam}/feedback`);
      const data = await res.json();
      if (data.success && data.feedback) {
        setExistingFeedback(data.feedback);
        setRating(data.feedback.rating || 5);
        setComment(data.feedback.comment || "");
        setIsAnonymous(Boolean(data.feedback.isAnonymous));
        if (data.feedback.categoryRatings) {
          setFoodQuality(data.feedback.categoryRatings.foodQuality || null);
          setPackaging(data.feedback.categoryRatings.packaging || null);
          setDelivery(data.feedback.categoryRatings.delivery || null);
          setService(data.feedback.categoryRatings.service || null);
        }
        if (data.feedback.complaint?.hasComplaint) {
          setHasComplaint(true);
          setComplaintCategory(data.feedback.complaint.category || "food_quality");
          setComplaintDescription(data.feedback.complaint.description || "");
        }
      } else {
        setExistingFeedback(null);
        setIsEditing(true);
      }
    } catch {
      // If error, fall back to creation mode
      setExistingFeedback(null);
      setIsEditing(true);
    } finally {
      setLoadingInitial(false);
    }
  }, [order]);

  useEffect(() => {
    if (isOpen) {
      fetchExistingFeedback();
    }
  }, [isOpen, fetchExistingFeedback]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !submitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setErrorMessage("Please select a rating between 1 and 5 stars.");
      return;
    }

    if (hasComplaint && !complaintCategory) {
      setErrorMessage("Please select a complaint category.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const orderParam = order.orderId || order._id;
      const endpoint = `/api/orders/${orderParam}/feedback`;
      const method = existingFeedback ? "PUT" : "POST";

      const payload = {
        rating,
        categoryRatings: {
          ...(foodQuality ? { foodQuality } : {}),
          ...(packaging ? { packaging } : {}),
          ...(delivery ? { delivery } : {}),
          ...(service ? { service } : {}),
        },
        comment: comment.trim(),
        isAnonymous,
        ...(!existingFeedback && hasComplaint
          ? {
              complaint: {
                hasComplaint: true,
                category: complaintCategory,
                description: complaintDescription.trim(),
              },
            }
          : {}),
      };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.message || "Failed to submit feedback. Please try again.");
        return;
      }

      toast.success(existingFeedback ? "Feedback updated successfully!" : "Thank you! Your feedback has been submitted.");
      setExistingFeedback(data.feedback);
      setIsEditing(false);
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(data.feedback);
      }
    } catch {
      setErrorMessage("A network error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isPickup =
    order.notes?.includes("[PICKUP]") ||
    order.orderType === "pickup" ||
    order.deliveryFee === 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[var(--border-color)] flex items-start justify-between gap-4 bg-[var(--bg-sub)]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-[var(--brand-accent)] bg-[var(--brand-accent)]/10 px-2 py-0.5 rounded border border-[var(--brand-accent)]/20">
                #{order.orderId || order._id.slice(-8)}
              </span>
              {order.restaurant?.name && (
                <span className="text-xs font-semibold text-[var(--text-main)] flex items-center gap-1">
                  <Building size={12} className="text-[var(--brand-accent)]" />
                  {order.restaurant.name}
                </span>
              )}
            </div>
            <h2 id="feedback-modal-title" className="text-lg font-black text-[var(--text-main)]">
              {existingFeedback && !isEditing ? "Your Order Feedback" : "Rate Your Experience"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)] transition cursor-pointer"
            aria-label="Close feedback modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {loadingInitial ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-[var(--brand-accent)] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-[var(--text-muted)]">Loading feedback details...</p>
            </div>
          ) : existingFeedback && !isEditing ? (
            // View existing feedback mode
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-muted)]">Overall Rating</span>
                  <div className="flex items-center gap-1 text-amber-400 font-bold font-mono">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={16}
                        className={existingFeedback.rating >= star ? "fill-amber-400" : "text-[var(--text-muted)] opacity-30"}
                      />
                    ))}
                    <span className="ml-1 text-xs text-[var(--text-main)]">({existingFeedback.rating}/5)</span>
                  </div>
                </div>

                {existingFeedback.categoryRatings && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-color)] text-xs">
                    {existingFeedback.categoryRatings.foodQuality && (
                      <div className="flex justify-between text-[var(--text-muted)]">
                        <span>Food Quality:</span>
                        <span className="font-bold text-[var(--text-main)]">{existingFeedback.categoryRatings.foodQuality}★</span>
                      </div>
                    )}
                    {existingFeedback.categoryRatings.packaging && (
                      <div className="flex justify-between text-[var(--text-muted)]">
                        <span>Packaging:</span>
                        <span className="font-bold text-[var(--text-main)]">{existingFeedback.categoryRatings.packaging}★</span>
                      </div>
                    )}
                    {existingFeedback.categoryRatings.delivery && (
                      <div className="flex justify-between text-[var(--text-muted)]">
                        <span>Delivery:</span>
                        <span className="font-bold text-[var(--text-main)]">{existingFeedback.categoryRatings.delivery}★</span>
                      </div>
                    )}
                    {existingFeedback.categoryRatings.service && (
                      <div className="flex justify-between text-[var(--text-muted)]">
                        <span>Service:</span>
                        <span className="font-bold text-[var(--text-main)]">{existingFeedback.categoryRatings.service}★</span>
                      </div>
                    )}
                  </div>
                )}

                {existingFeedback.comment && (
                  <div className="pt-2 border-t border-[var(--border-color)]">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Your Written Review:</p>
                    <p className="text-xs sm:text-sm text-[var(--text-main)] italic">
                      “{existingFeedback.comment}”
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 text-[11px] text-[var(--text-muted)]">
                  {existingFeedback.isAnonymous ? (
                    <span className="flex items-center gap-1 text-emerald-500 font-medium">
                      <ShieldCheck size={13} /> Posted Anonymously
                    </span>
                  ) : (
                    <span>Posted with your customer profile</span>
                  )}
                </div>
              </div>

              {/* Complaint Status if any */}
              {existingFeedback.complaint?.hasComplaint && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> Logged Complaint: {existingFeedback.complaint.category?.replace(/_/g, " ")}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                        existingFeedback.complaint.status === "resolved"
                          ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-500 border-amber-500/30"
                      }`}
                    >
                      {existingFeedback.complaint.status?.replace("_", " ")}
                    </span>
                  </div>
                  {existingFeedback.complaint.description && (
                    <p className="text-xs text-[var(--text-main)]">
                      {existingFeedback.complaint.description}
                    </p>
                  )}
                  {existingFeedback.complaint.resolutionNotes && (
                    <p className="text-xs text-emerald-500 font-medium pt-1 border-t border-amber-500/20">
                      Kitchen Resolution: {existingFeedback.complaint.resolutionNotes}
                    </p>
                  )}
                </div>
              )}

              {/* Restaurant Response if any */}
              {existingFeedback.response?.message && (
                <div className="p-4 rounded-2xl bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/25 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--brand-accent)] flex items-center gap-1.5">
                      <MessageSquare size={13} /> Official Restaurant Reply
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {existingFeedback.response.respondedBy?.name || "Staff"}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[var(--text-main)]">
                    {existingFeedback.response.message}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-sub)] hover:bg-[var(--border-color)] text-[var(--text-main)] font-bold text-xs transition cursor-pointer"
                >
                  Edit Your Review
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-[var(--brand-accent)] text-white font-bold text-xs hover:opacity-90 transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            // Feedback Submission / Edit Form
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-500">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Overall Star Rating */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-main)] block">
                  Overall Rating <span className="text-rose-500">*</span>
                </label>
                <InteractiveStarRating
                  value={rating}
                  onChange={setRating}
                  label="Overall Rating"
                  size={32}
                />
              </div>

              {/* Detailed Category Ratings (Collapsible / Optional) */}
              <div className="p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] space-y-3">
                <p className="text-xs font-bold text-[var(--text-main)]">
                  Category Ratings (Optional)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[var(--text-muted)] block mb-1">Food Quality:</span>
                    <InteractiveStarRating
                      value={foodQuality || 0}
                      onChange={setFoodQuality}
                      size={18}
                      label="Food Quality Rating"
                    />
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block mb-1">Packaging:</span>
                    <InteractiveStarRating
                      value={packaging || 0}
                      onChange={setPackaging}
                      size={18}
                      label="Packaging Rating"
                    />
                  </div>
                  {!isPickup && (
                    <div>
                      <span className="text-[var(--text-muted)] block mb-1">Delivery Experience:</span>
                      <InteractiveStarRating
                        value={delivery || 0}
                        onChange={setDelivery}
                        size={18}
                        label="Delivery Rating"
                      />
                    </div>
                  )}
                  <div>
                    <span className="text-[var(--text-muted)] block mb-1">Restaurant Service:</span>
                    <InteractiveStarRating
                      value={service || 0}
                      onChange={setService}
                      size={18}
                      label="Service Rating"
                    />
                  </div>
                </div>
              </div>

              {/* Written Review */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-[var(--text-main)]">
                    Written Review (Optional)
                  </label>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    {comment.length}/2000
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share details about flavor, portion sizes, or overall dining experience..."
                  className="w-full bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-2xl p-3 text-xs sm:text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] transition resize-none"
                />
              </div>

              {/* Anonymity Toggle */}
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)]">
                <input
                  id="anonymous-toggle"
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[var(--border-color)] text-[var(--brand-accent)] focus:ring-[var(--brand-accent)] cursor-pointer"
                />
                <label htmlFor="anonymous-toggle" className="text-xs cursor-pointer select-none">
                  <span className="font-bold text-[var(--text-main)] block">
                    Post review anonymously
                  </span>
                  <span className="text-[var(--text-muted)] text-[11px] leading-relaxed block mt-0.5">
                    Your name and identity will be masked as “Anonymous Diner” on all public and restaurant review views.
                  </span>
                </label>
              </div>

              {/* Complaint Section (Only during creation) */}
              {!existingFeedback && (
                <div className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sub)] space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="complaint-toggle" className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5 cursor-pointer">
                      <AlertTriangle size={14} className={hasComplaint ? "text-amber-500" : "text-[var(--text-muted)]"} />
                      Report an issue or complaint with this order
                    </label>
                    <input
                      id="complaint-toggle"
                      type="checkbox"
                      checked={hasComplaint}
                      onChange={(e) => setHasComplaint(e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--border-color)] text-[var(--brand-accent)] focus:ring-[var(--brand-accent)] cursor-pointer"
                    />
                  </div>

                  {hasComplaint && (
                    <div className="pt-3 border-t border-[var(--border-color)] space-y-3 animate-in fade-in duration-150">
                      <div>
                        <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
                          Complaint Category
                        </label>
                        <select
                          value={complaintCategory}
                          onChange={(e) => setComplaintCategory(e.target.value)}
                          className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] cursor-pointer"
                        >
                          {COMPLAINT_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-[11px] text-[var(--text-muted)] mb-1">
                          <span>Complaint Description</span>
                          <span>{complaintDescription.length}/2000</span>
                        </div>
                        <textarea
                          rows={2}
                          maxLength={2000}
                          value={complaintDescription}
                          onChange={(e) => setComplaintDescription(e.target.value)}
                          placeholder="Please describe what went wrong so restaurant management can investigate and resolve it..."
                          className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-2.5 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] transition resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                {existingFeedback && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-sub)] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-sub)] transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[var(--brand-accent)] hover:opacity-90 text-white font-bold text-xs shadow-md shadow-[var(--brand-accent)]/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <span>Submitting...</span>
                  ) : (
                    <span>{existingFeedback ? "Save Changes" : "Submit Feedback"}</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
