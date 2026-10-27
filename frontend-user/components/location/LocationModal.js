"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MapPin,
  Crosshair,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Navigation,
  Info,
} from "lucide-react";
import {
  useLocationStore,
  SUGGESTED_LOCATIONS,
} from "@/lib/locationStore";
import DeliveryLocationMapPicker from "@/components/checkout/DeliveryLocationMapPicker";

export default function LocationModal() {
  const {
    location,
    locationDetails,
    isModalOpen,
    status,
    statusMessage,
    closeModal,
    selectLocation,
    confirmSelectedLocation,
    detectCurrentLocation,
    setCoordinatesAndCheck,
  } = useLocationStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      const handleKeyDown = (e) => {
        if (e.key === "Escape" && !isMapPickerOpen) closeModal();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isModalOpen, closeModal, isMapPickerOpen]);

  if (!isModalOpen) return null;

  const filteredLocations = SUGGESTED_LOCATIONS.filter(
    (loc) =>
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    selectLocation(searchQuery.trim());
  };

  const handleMapPinSelected = (coords) => {
    setIsMapPickerOpen(false);
    if (coords && coords.latitude && coords.longitude) {
      setCoordinatesAndCheck({
        latitude: coords.latitude,
        longitude: coords.longitude,
        name: `Map Pin (${coords.latitude.toFixed(2)}°, ${coords.longitude.toFixed(2)}°)`,
        area: "Interactive Map Selection",
        isApproximate: false,
      });
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Select Delivery Location"
        className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200 ${
          isMapPickerOpen ? "hidden pointer-events-none" : ""
        }`}
        onClick={(e) => {
          if (e.target === e.currentTarget && !isMapPickerOpen) closeModal();
        }}
      >
        <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-[fadeIn_0.2s_ease-out]">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[var(--border-color)] flex items-center justify-between shrink-0 bg-[var(--bg-main)]/50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] flex items-center justify-center border border-[var(--brand-accent)]/20 shadow-xs">
                <MapPin size={18} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[var(--text-main)] tracking-tight">
                  Select Delivery Location
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Verify actual kitchen delivery serviceability to your doorstep
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close location selector"
              className="w-8 h-8 rounded-full bg-[var(--bg-sub)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center justify-center transition border border-[var(--border-color)] cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
            {/* Search bar */}
            <form onSubmit={handleCustomSubmit} className="relative">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search area, landmark or street name..."
                className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs sm:text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-accent)] focus:bg-[var(--bg-card)] transition outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </form>

            {/* Quick Action Grid (Current GPS & Map Picker) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Device GPS Action */}
              <button
                type="button"
                onClick={detectCurrentLocation}
                disabled={status === "detecting"}
                className="flex items-center justify-between p-3 rounded-2xl bg-[var(--brand-accent)]/5 hover:bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/25 text-[var(--text-main)] transition group active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className="w-8 h-8 rounded-xl bg-[var(--brand-accent)] text-white flex items-center justify-center shadow-xs shrink-0">
                    <Crosshair
                      size={16}
                      className={status === "detecting" ? "animate-spin" : "group-hover:rotate-45 transition-transform"}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--brand-accent)] flex items-center gap-1">
                      <span>{status === "detecting" ? "Locating..." : "Use Device GPS"}</span>
                      <Sparkles size={11} />
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)]">Automatic pin</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[var(--brand-accent)] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>

              {/* Pin on Map Action */}
              <button
                type="button"
                onClick={() => setIsMapPickerOpen(true)}
                className="flex items-center justify-between p-3 rounded-2xl bg-[var(--bg-sub)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-main)] transition group active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs shrink-0">
                    <Navigation size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--text-main)]">
                      Drop Pin on Map
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)]">Interactive map</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            </div>

            {/* ── LIVE SERVICEABILITY STATUS FEEDBACK ── */}
            {status === "checking" && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-xs text-amber-700 dark:text-amber-400">
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Checking partner kitchen delivery coverage in your area...</span>
              </div>
            )}

            {status === "available" && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Delivery Available</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    Serviceable
                  </span>
                </div>
                <p className="text-xs text-[var(--text-main)] leading-relaxed">
                  {statusMessage || `Great news! Verified kitchens can deliver fresh food to ${location}.`}
                </p>
                {locationDetails?.hasExactCoordinates && (
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {locationDetails.isApproximate
                      ? "Device GPS coordinates saved. You can fine-tune your street address at checkout."
                      : "Exact map coordinates saved for doorstep delivery."}
                  </p>
                )}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={confirmSelectedLocation}
                    className="w-full py-2.5 rounded-xl bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-xs font-bold shadow-md shadow-[var(--brand-accent)]/20 transition active:scale-98 cursor-pointer"
                  >
                    Confirm & Explore Menu
                  </button>
                </div>
              </div>
            )}

            {status === "city_selected" && (
              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400">
                    <Info size={16} className="text-blue-500 shrink-0" />
                    <span>City Preference Selected</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300">
                    Area Search
                  </span>
                </div>
                <p className="text-xs text-[var(--text-main)] leading-relaxed">
                  {statusMessage || `Showing kitchens serving the ${location} region.`}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Note: A city preference filters available menus. Exact delivery eligibility will be confirmed with your GPS pin or street address.
                </p>
                <div className="pt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={confirmSelectedLocation}
                    className="flex-1 py-2 rounded-xl bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-xs font-bold transition active:scale-98 cursor-pointer"
                  >
                    Browse Kitchens
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMapPickerOpen(true)}
                    className="flex-1 py-2 rounded-xl bg-[var(--bg-sub)] hover:bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-bold transition active:scale-98 cursor-pointer"
                  >
                    Pin Exact Address
                  </button>
                </div>
              </div>
            )}

            {status === "unavailable" && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-400">
                    <AlertCircle size={16} className="text-rose-500 shrink-0" />
                    <span>Outside Delivery Zone</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300">
                    Unserviceable
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {statusMessage || "Partner kitchens currently do not deliver to this exact location. Counter self-pickup may still be available."}
                </p>
                <div className="pt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMapPickerOpen(true)}
                    className="flex-1 py-2 rounded-xl bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-xs font-bold transition active:scale-98 cursor-pointer"
                  >
                    Adjust Pin on Map
                  </button>
                  <button
                    type="button"
                    onClick={confirmSelectedLocation}
                    className="flex-1 py-2 rounded-xl bg-[var(--bg-sub)] hover:bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-bold transition active:scale-98 cursor-pointer"
                  >
                    Browse Pickup Menu
                  </button>
                </div>
              </div>
            )}

            {/* Popular City & Region Hubs */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] px-1">
                Popular Cities & Hubs
              </h3>
              <div className="divide-y divide-[var(--border-color)] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sub)]/50 overflow-hidden">
                {filteredLocations.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                    No matching hubs found for &ldquo;{searchQuery}&rdquo;. Press Enter to use custom address.
                  </div>
                ) : (
                  filteredLocations.map((locItem) => {
                    const isSelected =
                      locationDetails?.name?.toLowerCase() === locItem.name.toLowerCase();
                    return (
                      <button
                        key={locItem.id}
                        type="button"
                        onClick={() => selectLocation(locItem)}
                        className={`w-full flex items-center justify-between p-3 text-left transition hover:bg-[var(--bg-card)] cursor-pointer ${
                          isSelected ? "bg-[var(--brand-accent)]/10" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <MapPin
                            size={16}
                            className={
                              isSelected
                                ? "text-[var(--brand-accent)] shrink-0"
                                : "text-[var(--text-muted)] shrink-0"
                            }
                          />
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-bold text-[var(--text-main)] truncate">
                              {locItem.name}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] truncate">
                              {locItem.area}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2 pl-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)]">
                            City Hub
                          </span>
                          {isSelected && (
                            <CheckCircle2 size={16} className="text-[var(--brand-accent)]" />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3.5 sm:p-4 border-t border-[var(--border-color)] bg-[var(--bg-main)]/50 flex items-center justify-between gap-3 shrink-0">
            <div className="text-[11px] text-[var(--text-muted)] truncate">
              Selected: <span className="font-bold text-[var(--text-main)]">{location}</span>
            </div>
            <button
              type="button"
              onClick={confirmSelectedLocation}
              className="px-4 py-2 rounded-xl bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-xs font-bold transition shadow-sm active:scale-95 shrink-0 cursor-pointer"
            >
              Save & Close
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Delivery Location Map Picker modal */}
      {isMapPickerOpen && (
        <DeliveryLocationMapPicker
          isOpen={isMapPickerOpen}
          onClose={() => setIsMapPickerOpen(false)}
          onSelectLocation={handleMapPinSelected}
          initialCoordinates={
            locationDetails?.latitude && locationDetails?.longitude
              ? { latitude: locationDetails.latitude, longitude: locationDetails.longitude }
              : null
          }
        />
      )}
    </>
  );
}
