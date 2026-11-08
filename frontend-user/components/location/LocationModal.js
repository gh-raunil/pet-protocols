"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
  Lock,
} from "lucide-react";
import {
  useLocationStore,
  SUGGESTED_LOCATIONS,
} from "@/lib/locationStore";
import DeliveryLocationMapPicker from "@/components/checkout/DeliveryLocationMapPicker";

export default function LocationModal() {
  const { data: session } = useSession();
  const router = useRouter();
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
  const [activeHubs, setActiveHubs] = useState(SUGGESTED_LOCATIONS);
  const [loadingHubs, setLoadingHubs] = useState(false);
  const inputRef = useRef(null);

  // Fetch actual restaurants to dynamically show locations where restaurants exist
  useEffect(() => {
    let isMounted = true;
    async function loadActiveHubs() {
      try {
        setLoadingHubs(true);
        const res = await fetch("/api/restaurants");
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.restaurants)) {
          const activeWithAddress = data.restaurants.filter(
            (r) => r.status === "active" && r.address && (r.address.city || r.address.street)
          );
          if (activeWithAddress.length > 0) {
            const derivedHubs = activeWithAddress.map((r) => {
              const city = (r.address.city || "").trim();
              const state = (r.address.state || "").trim();
              const street = (r.address.street || r.address.landmark || "").trim();
              const displayCity = city && state ? `${city}, ${state}` : (city || r.name);
              const displayArea = street ? `${street} • ${r.name}` : r.name;

              return {
                id: `hub_${r._id}`,
                name: displayCity,
                area: displayArea,
                city: city || displayCity,
                state: state,
                restaurantName: r.name,
                restaurantId: r._id,
                latitude: r.address.latitude,
                longitude: r.address.longitude,
                hasExactCoordinates: Boolean(r.address.latitude && r.address.longitude),
                isApproximate: false,
                deliveryRadiusKm: r.deliverySettings?.deliveryRadiusKm || 10,
                cuisine: Array.isArray(r.cuisineType) ? r.cuisineType.join(", ") : r.cuisineType || "",
              };
            });
            setActiveHubs(derivedHubs);
          }
        }
      } catch (err) {
        console.warn("Failed to load active kitchen hubs:", err);
      } finally {
        if (isMounted) setLoadingHubs(false);
      }
    }
    loadActiveHubs();
    return () => {
      isMounted = false;
    };
  }, []);

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

  if (!session) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign In to Select Location"
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/65 backdrop-blur-xs transition-opacity duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
      >
        <div className="w-full max-w-md rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden flex flex-col p-6 sm:p-8 text-center space-y-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close location selector"
              className="w-8 h-8 rounded-full bg-[var(--bg-sub)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center justify-center transition border border-[var(--border-color)] cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] flex items-center justify-center mx-auto border border-[var(--brand-accent)]/20 shadow-xs">
            <Lock size={26} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-extrabold text-[var(--text-main)]">
              Sign In Required
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed">
              You must be logged in to set your delivery location and verify doorstep kitchen serviceability.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                closeModal();
                router.push("/auth/login");
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold text-xs transition cursor-pointer shadow-xs active:scale-95"
            >
              <span>Sign In to Set Location</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayHubs = activeHubs && activeHubs.length > 0 ? activeHubs : SUGGESTED_LOCATIONS;

  const filteredLocations = displayHubs.filter(
    (loc) =>
      (loc.name && loc.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (loc.area && loc.area.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (loc.city && loc.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (loc.restaurantName && loc.restaurantName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    selectLocation(searchQuery.trim());
  };

  const handleSelectHub = (locItem) => {
    if (locItem.latitude && locItem.longitude) {
      setCoordinatesAndCheck({
        latitude: locItem.latitude,
        longitude: locItem.longitude,
        name: locItem.name,
        area: locItem.area,
        city: locItem.city,
        state: locItem.state,
        restaurantId: locItem.restaurantId,
        restaurantName: locItem.restaurantName,
        isApproximate: false,
      });
    } else {
      selectLocation(locItem);
    }
  };

  const handleConfirmAndExploreMenu = () => {
    confirmSelectedLocation();
    router.push("/menu");
  };

  const handleMapPinSelected = (coords) => {
    setIsMapPickerOpen(false);
    if (coords && coords.latitude && coords.longitude) {
      setCoordinatesAndCheck({
        latitude: coords.latitude,
        longitude: coords.longitude,
        name: "Pinned Location",
        area: "Selected on Map",
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
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/65 backdrop-blur-xs transition-opacity duration-200 ${
          isMapPickerOpen ? "hidden pointer-events-none" : ""
        }`}
        onClick={(e) => {
          if (e.target === e.currentTarget && !isMapPickerOpen) closeModal();
        }}
      >
        <div className="w-full max-w-lg rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden flex flex-col max-h-[min(82vh,680px)] animate-[fadeIn_0.2s_ease-out]">
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
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
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
                      ? "Delivery location saved. You can fine-tune your street address at checkout."
                      : "Exact doorstep delivery location confirmed."}
                  </p>
                )}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleConfirmAndExploreMenu}
                    className="w-full py-2.5 rounded-xl bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-xs font-bold shadow-md shadow-[var(--brand-accent)]/20 transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Confirm & Explore Menu</span>
                    <ArrowRight size={14} />
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
                    onClick={handleConfirmAndExploreMenu}
                    className="flex-1 py-2 rounded-xl bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-xs font-bold transition active:scale-98 cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>Explore Menu</span>
                    <ArrowRight size={13} />
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

            {/* Popular City & Region Hubs with Actual Active Restaurants */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Active Kitchen Cities & Hubs ({filteredLocations.length})
                </h3>
                {loadingHubs && (
                  <span className="text-[10px] text-[var(--text-muted)] animate-pulse">
                    Refreshing hubs...
                  </span>
                )}
              </div>
              <div className="divide-y divide-[var(--border-color)] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sub)]/50 overflow-hidden">
                {filteredLocations.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                    No matching restaurant cities found for &ldquo;{searchQuery}&rdquo;. Try another city or drop a pin on the map.
                  </div>
                ) : (
                  filteredLocations.map((locItem) => {
                    const isSelected =
                      locationDetails?.name?.toLowerCase() === locItem.name.toLowerCase() ||
                      (locationDetails?.latitude &&
                        locItem.latitude &&
                        Math.abs(locationDetails.latitude - locItem.latitude) < 0.001 &&
                        Math.abs(locationDetails.longitude - locItem.longitude) < 0.001);

                    return (
                      <button
                        key={locItem.id}
                        type="button"
                        onClick={() => handleSelectHub(locItem)}
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
                            <div className="text-xs sm:text-sm font-bold text-[var(--text-main)] truncate flex items-center gap-1.5">
                              <span>{locItem.name}</span>
                              {locItem.restaurantName && (
                                <span className="text-[10px] font-semibold text-[var(--brand-accent)] bg-[var(--brand-accent)]/10 px-1.5 py-0.2 rounded-md">
                                  {locItem.restaurantName}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] truncate">
                              {locItem.area}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2 pl-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-card)] text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Active Hub</span>
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
              Selected: <span className="font-bold text-[var(--text-main)]">{location && (location.includes("°") || location.startsWith("Device GPS") || location.startsWith("Map Pin")) ? "My Location" : location}</span>
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
