"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  MapPin,
  Crosshair,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Store,
  Compass,
  Layers,
  ChevronDown,
  Check,
  Plus,
  Minus,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

// Fallback coordinates (Vellore / Katpadi area or India center)
const DEFAULT_LAT = 12.9698;
const DEFAULT_LNG = 79.1550;

export const MAP_LAYERS = [
  {
    id: "default",
    name: "Street View",
    subtext: "Standard OpenStreetMap with roads & buildings",
    icon: "🗺️",
    base: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    overlay: null,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    id: "satellite",
    name: "Satellite Hybrid",
    subtext: "High-resolution aerial imagery + road overlays",
    icon: "🛰️",
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    subdomains: "abc",
    overlay: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; National Geographic, Esri",
    maxZoom: 19,
  },
  {
    id: "terrain",
    name: "Topo & Terrain",
    subtext: "Elevation relief, contours & natural geography",
    icon: "⛰️",
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    subdomains: "abc",
    overlay: null,
    attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    maxZoom: 19,
  },
  {
    id: "dark",
    name: "Night Mode",
    subtext: "Dark high-contrast mode for night management",
    icon: "🌙",
    base: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    overlay: null,
    attribution: '&copy; CARTO',
    maxZoom: 19,
  },
  {
    id: "light",
    name: "Clean Light",
    subtext: "Minimalist greyscale for crisp spatial layout",
    icon: "🏙️",
    base: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    overlay: null,
    attribution: '&copy; CARTO',
    maxZoom: 19,
  },
];

function isValidCoordinate(lat, lng) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return (
    Number.isFinite(nLat) &&
    Number.isFinite(nLng) &&
    nLat >= -90 &&
    nLat <= 90 &&
    nLng >= -180 &&
    nLng <= 180 &&
    !(nLat === 0 && nLng === 0)
  );
}

export default function RestaurantLocationPicker({
  address = {},
  onChangeAddress,
  restaurantName = "Restaurant",
  radiusKm = null,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const circleRef = useRef(null);
  const baseLayerRef = useRef(null);
  const overlayLayerRef = useRef(null);
  const layerMenuRef = useRef(null);

  const initialLat = Number(address.latitude) || 0;
  const initialLng = Number(address.longitude) || 0;
  const hasValidCoords = isValidCoordinate(initialLat, initialLng);

  const [currentLat, setCurrentLat] = useState(hasValidCoords ? initialLat : DEFAULT_LAT);
  const [currentLng, setCurrentLng] = useState(hasValidCoords ? initialLng : DEFAULT_LNG);
  const [isMoving, setIsMoving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [copied, setCopied] = useState(false);

  // Map Tile Layer state with local storage persistence
  const [activeLayer, setActiveLayer] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("pet_admin_map_layer");
        if (saved && MAP_LAYERS.some((l) => l.id === saved)) return saved;
      } catch {}
    }
    return "default";
  });

  // Layer Overlays (Feature Layers)
  const [showRadius, setShowRadius] = useState(true);
  const [showReticle, setShowReticle] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Escape key listener for fullscreen mode
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    }
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, [isFullscreen]);

  // Invalidate map size when toggling fullscreen
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    [50, 150, 300, 500].forEach((delay) => {
      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {}
      }, delay);
    });
  }, [isFullscreen]);

  const currentLayerObj = MAP_LAYERS.find((l) => l.id === activeLayer) || MAP_LAYERS[0];

  const handleSelectLayer = useCallback((layerId) => {
    setActiveLayer(layerId);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pet_admin_map_layer", layerId);
      } catch {}
    }
  }, []);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  }, []);

  // Close layer menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (layerMenuRef.current && !layerMenuRef.current.contains(e.target)) {
        setLayerMenuOpen(false);
      }
    }
    if (layerMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [layerMenuOpen]);

  // Sync internal state when external address prop changes externally
  useEffect(() => {
    if (isValidCoordinate(address.latitude, address.longitude)) {
      const newLat = Number(address.latitude);
      const newLng = Number(address.longitude);
      setCurrentLat(newLat);
      setCurrentLng(newLng);

      if (mapInstanceRef.current && !isMoving) {
        const center = mapInstanceRef.current.getCenter();
        const dist = Math.abs(center.lat - newLat) + Math.abs(center.lng - newLng);
        if (dist > 0.0001) {
          mapInstanceRef.current.setView([newLat, newLng], mapInstanceRef.current.getZoom());
        }
      }
    }
  }, [address.latitude, address.longitude]);

  // Update coordinates to parent form
  const applyCoordinates = useCallback(
    (newLat, newLng, extraAddressDetails = {}) => {
      const fixedLat = Number(Number(newLat).toFixed(6));
      const fixedLng = Number(Number(newLng).toFixed(6));

      setCurrentLat(fixedLat);
      setCurrentLng(fixedLng);

      onChangeAddress({
        ...address,
        latitude: fixedLat,
        longitude: fixedLng,
        ...extraAddressDetails,
      });

      setFeedback({
        type: "success",
        message: `Center position locked: ${fixedLat}, ${fixedLng}`,
      });
      setTimeout(() => setFeedback(null), 3500);
    },
    [address, onChangeAddress]
  );

  // Initialize Leaflet Map (Map pans underneath the fixed center pin)
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    import("leaflet").then(({ default: L }) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Clean up previous instance
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }

      const initialCenter = hasValidCoords
        ? [initialLat, initialLng]
        : [DEFAULT_LAT, DEFAULT_LNG];
      const initialZoom = hasValidCoords ? 17 : 14;

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: "center",
      });
      mapInstanceRef.current = map;

      // Initial Tile Layer
      const layerConfig = MAP_LAYERS.find((l) => l.id === activeLayer) || MAP_LAYERS[0];
      baseLayerRef.current = L.tileLayer(layerConfig.base, {
        maxZoom: layerConfig.maxZoom,
        subdomains: layerConfig.subdomains || "abc",
        attribution: layerConfig.attribution,
      }).addTo(map);

      if (layerConfig.overlay && showLabels) {
        overlayLayerRef.current = L.tileLayer(layerConfig.overlay, {
          maxZoom: layerConfig.maxZoom,
          subdomains: layerConfig.subdomains || "abc",
        }).addTo(map);
      }

      // Delivery Radius Circle centered on the map
      if (showRadius && radiusKm && Number(radiusKm) > 0) {
        const circle = L.circle(initialCenter, {
          radius: Number(radiusKm) * 1000,
          color: "#f97316",
          fillColor: "#f97316",
          fillOpacity: 0.12,
          weight: 2,
          dashArray: "6, 6",
        }).addTo(map);
        circleRef.current = circle;
      }

      // Map move listeners — tracking the center coordinate
      map.on("movestart", () => {
        setIsMoving(true);
      });

      map.on("move", () => {
        const center = map.getCenter();
        const latVal = Number(center.lat.toFixed(6));
        const lngVal = Number(center.lng.toFixed(6));
        setCurrentLat(latVal);
        setCurrentLng(lngVal);

        if (circleRef.current) {
          circleRef.current.setLatLng(center);
        }
      });

      map.on("moveend", () => {
        setIsMoving(false);
        const center = map.getCenter();
        applyCoordinates(center.lat, center.lng);
      });

      // Invalidate size to ensure crisp rendering inside tabs
      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {}
      }, 150);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
    };
  }, []); // Run once on mount

  // Switch Tile Layer when activeLayer or showLabels changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof window === "undefined") return;

    import("leaflet").then(({ default: L }) => {
      if (baseLayerRef.current) {
        try {
          map.removeLayer(baseLayerRef.current);
        } catch {}
      }
      if (overlayLayerRef.current) {
        try {
          map.removeLayer(overlayLayerRef.current);
        } catch {}
        overlayLayerRef.current = null;
      }

      const layerConfig = MAP_LAYERS.find((l) => l.id === activeLayer) || MAP_LAYERS[0];
      baseLayerRef.current = L.tileLayer(layerConfig.base, {
        maxZoom: layerConfig.maxZoom,
        subdomains: layerConfig.subdomains || "abc",
        attribution: layerConfig.attribution,
      }).addTo(map);

      if (layerConfig.overlay && showLabels) {
        overlayLayerRef.current = L.tileLayer(layerConfig.overlay, {
          maxZoom: layerConfig.maxZoom,
          subdomains: layerConfig.subdomains || "abc",
        }).addTo(map);
      }
    });
  }, [activeLayer, showLabels]);

  // Update Delivery Circle when radiusKm prop or showRadius changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof window === "undefined") return;

    import("leaflet").then(({ default: L }) => {
      if (!showRadius || !radiusKm || Number(radiusKm) <= 0) {
        if (circleRef.current) {
          try {
            map.removeLayer(circleRef.current);
          } catch {}
          circleRef.current = null;
        }
        return;
      }

      const center = map.getCenter();
      if (!circleRef.current) {
        circleRef.current = L.circle(center, {
          radius: Number(radiusKm) * 1000,
          color: "#f97316",
          fillColor: "#f97316",
          fillOpacity: 0.12,
          weight: 2,
          dashArray: "6, 6",
        }).addTo(map);
      } else {
        circleRef.current.setRadius(Number(radiusKm) * 1000);
        circleRef.current.setLatLng(center);
        if (!map.hasLayer(circleRef.current)) {
          circleRef.current.addTo(map);
        }
      }
    });
  }, [radiusKm, showRadius]);



  // Handle Search Location by place name / landmark
  async function handleSearchPlace(e) {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      setSearchResults([]);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=5&countrycodes=in`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setSearchResults(data);
      } else {
        setFeedback({ type: "info", message: "No locations found. Try a different landmark or pincode." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to search location." });
    } finally {
      setIsSearching(false);
    }
  }

  function handleSelectSearchResult(item) {
    const itemLat = parseFloat(item.lat);
    const itemLng = parseFloat(item.lon);
    if (!isValidCoordinate(itemLat, itemLng)) return;

    // Fly map so the searched place is centered under the fixed pin
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([itemLat, itemLng], 17, { duration: 1.2 });
    }
    if (circleRef.current) {
      circleRef.current.setLatLng([itemLat, itemLng]);
    }

    applyCoordinates(itemLat, itemLng);
    setSearchResults([]);
    setSearchQuery("");
  }

  // Copy coordinates
  function handleCopyCoords() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`${currentLat}, ${currentLng}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-3 font-jakarta">
      {/* Header & Fixed Location Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <label className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-orange-500" />
              <span>Restaurant Fixed Location & Dispatch Address Pin</span>
            </label>
            {hasValidCoords ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>Fixed Location Set</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                <span>Set Kitchen Location</span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Set your restaurant&apos;s static address using the search bar or by dragging the map pin. This fixed location is used for order routing and customer pickup. Restaurant live GPS is never tracked.
          </p>
        </div>
      </div>

      {/* Search Place / Landmark Form */}
      <div className="relative">
        <form onSubmit={handleSearchPlace} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search locality, street, or landmark (e.g. Katpadi, Indiranagar, Connaught Place)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-white text-xs outline-none focus:border-orange-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition cursor-pointer shrink-0"
          >
            {isSearching ? "Searching..." : "Find"}
          </button>
        </form>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white dark:bg-[#121622] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {searchResults.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSearchResult(item)}
                className="w-full text-left p-2.5 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-xs text-zinc-700 dark:text-zinc-300 flex items-start gap-2 transition cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{item.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : feedback.type === "error"
              ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
              : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Interactive Map Canvas Container with FIXED Center Pin */}
      <div
        className={`relative overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-inner bg-zinc-900 select-none transition-all duration-300 ${
          isFullscreen
            ? "fixed inset-0 z-[99999] w-screen h-screen rounded-none flex flex-col bg-zinc-950"
            : "rounded-2xl"
        }`}
      >
        {/* Leaflet Map Canvas (Expanded height for ample spatial context) */}
        <div
          ref={mapContainerRef}
          className={`w-full z-0 cursor-grab active:cursor-grabbing transition-all duration-300 ${
            isFullscreen ? "h-full flex-1" : "h-[480px] sm:h-[540px] md:h-[580px]"
          }`}
          style={{ minHeight: isFullscreen ? "100%" : "460px" }}
        />

        {/* ── FIXED CENTER PIN OVERLAY (Swiggy/Uber pattern) ── */}
        <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
          {/* Ground Target Concentric Rings (toggleable via showReticle) */}
          {showReticle && (
            <div
              className={`w-9 h-9 rounded-full border-2 border-orange-500/50 bg-orange-500/10 transition-all duration-200 flex items-center justify-center ${
                isMoving ? "scale-125 opacity-90 border-orange-400" : "scale-100 opacity-60"
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm" />
            </div>
          )}

          {/* Ground drop-shadow beneath pin tip */}
          <div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-1 rounded-full bg-black/40 blur-[2px] transition-all duration-200 ${
              isMoving ? "w-4 h-1.5 opacity-30" : "w-6 h-2 opacity-60"
            }`}
          />

          {/* Floating Store Marker: anchored exactly above the center point */}
          <div
            className={`absolute bottom-1/2 left-1/2 -translate-x-1/2 flex flex-col items-center transition-transform duration-200 ease-out ${
              isMoving ? "-translate-y-3 scale-105" : "translate-y-0 scale-100"
            }`}
            style={{ transformOrigin: "bottom center" }}
          >
            {/* Status Speech Bubble over pin */}
            <div className="mb-1.5 px-3 py-1 rounded-xl bg-black/90 backdrop-blur-md border border-white/20 text-[11px] font-bold text-white shadow-2xl whitespace-nowrap flex items-center gap-1.5 animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span>{isMoving ? "Release map to lock location" : `${restaurantName || "Kitchen"} Location`}</span>
            </div>

            {/* Store Icon Pill */}
            <div className="relative flex flex-col items-center">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 border-[2.5px] border-white shadow-2xl flex items-center justify-center text-white text-xl">
                🏪
              </div>
              {/* Sharp Pointer Tip */}
              <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-orange-600 -mt-[1px]" />
            </div>
          </div>
        </div>

        {/* Floating Top-Left Instructions Pill */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-[11px] text-white flex items-center gap-2 shadow-lg">
          <Compass className="w-3.5 h-3.5 text-orange-400 animate-spin" style={{ animationDuration: "12s" }} />
          <span className="hidden sm:inline">Pan map to center your location</span>
          <span className="sm:hidden">Pan map</span>
        </div>

        {/* Floating Top-Right Map Layers & Overlays Switcher */}
        <div className="absolute top-3 right-3 z-30" ref={layerMenuRef}>
          <button
            type="button"
            onClick={() => setLayerMenuOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/85 hover:bg-black text-white text-[11px] font-bold border border-white/20 shadow-xl backdrop-blur-md transition cursor-pointer"
            title="Switch Map Layer"
          >
            <Layers className="w-3.5 h-3.5 text-orange-400" />
            <span className="flex items-center gap-1">
              <span>{currentLayerObj.icon}</span>
              <span className="hidden sm:inline">{currentLayerObj.name}</span>
            </span>
            <ChevronDown
              className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${
                layerMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Small & Minimal Layer Options Popover */}
          {layerMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-stone-900/95 dark:bg-[#121622]/95 border border-white/15 dark:border-zinc-800 rounded-xl shadow-2xl p-1 space-y-0.5 animate-in fade-in zoom-in-95 z-50 backdrop-blur-md">
              <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
                Map Layers
              </div>

              {/* Base Map Layers */}
              {MAP_LAYERS.map((layer) => {
                const isSelected = activeLayer === layer.id;
                return (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => {
                      handleSelectLayer(layer.id);
                      setLayerMenuOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1 rounded-lg text-[11px] flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? "bg-orange-500 text-white font-bold shadow-xs"
                        : "text-stone-200 hover:bg-white/10 dark:hover:bg-zinc-800/80 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs shrink-0">{layer.icon}</span>
                      <span className="truncate">{layer.name}</span>
                    </div>
                    {isSelected && <Check className="w-3 h-3 shrink-0 ml-1" />}
                  </button>
                );
              })}

              {/* Feature Overlays Toggles */}
              <div className="pt-1 mt-1 border-t border-white/10 dark:border-zinc-800 space-y-0.5">
                <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
                  Overlays
                </div>

                {/* Delivery Radius Overlay */}
                {radiusKm && Number(radiusKm) > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowRadius((prev) => !prev)}
                    className="w-full text-left px-2 py-1 rounded-lg text-[10px] flex items-center justify-between text-stone-300 hover:bg-white/10 dark:hover:bg-zinc-800/80 transition cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>⭕</span>
                      <span>Radius ({radiusKm}km)</span>
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        showRadius
                          ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                          : "bg-white/10 text-stone-400"
                      }`}
                    >
                      {showRadius ? "ON" : "OFF"}
                    </span>
                  </button>
                )}

                {/* Center Reticle Rings */}
                <button
                  type="button"
                  onClick={() => setShowReticle((prev) => !prev)}
                  className="w-full text-left px-2 py-1 rounded-lg text-[10px] flex items-center justify-between text-stone-300 hover:bg-white/10 dark:hover:bg-zinc-800/80 transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span>🎯</span>
                    <span>Target Rings</span>
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      showReticle
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-white/10 text-stone-400"
                    }`}
                  >
                    {showReticle ? "ON" : "OFF"}
                  </span>
                </button>

                {/* Satellite Labels Toggle */}
                {currentLayerObj.overlay && (
                  <button
                    type="button"
                    onClick={() => setShowLabels((prev) => !prev)}
                    className="w-full text-left px-2 py-1 rounded-lg text-[10px] flex items-center justify-between text-stone-300 hover:bg-white/10 dark:hover:bg-zinc-800/80 transition cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>🏷️</span>
                      <span>Road Labels</span>
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        showLabels
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "bg-white/10 text-stone-400"
                      }`}
                    >
                      {showLabels ? "ON" : "OFF"}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Floating Right Map Navigation Controls (Fullscreen & Zoom) */}
        <div className="absolute right-3 bottom-16 z-20 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="w-8 h-8 rounded-xl bg-black/80 hover:bg-black text-white text-xs font-bold border border-white/20 shadow-xl flex items-center justify-center transition cursor-pointer backdrop-blur-md"
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Expand Map to Fullscreen"}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Expand Map to Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-orange-400" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-xl bg-black/80 hover:bg-black text-white text-xs font-bold border border-white/20 shadow-xl flex items-center justify-center transition cursor-pointer backdrop-blur-md"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-xl bg-black/80 hover:bg-black text-white text-xs font-bold border border-white/20 shadow-xl flex items-center justify-center transition cursor-pointer backdrop-blur-md"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {/* Floating Bottom Coordinates Bar */}
        <div className="absolute bottom-3 left-3 right-3 z-10 bg-white/95 dark:bg-[#10141f]/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-zinc-200/90 dark:border-white/10 shadow-xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300 font-mono text-[11px]">
            <Store className="w-4 h-4 text-orange-500 shrink-0" />
            <div className="flex items-center gap-2">
              <span>
                Lat: <strong>{Number(currentLat).toFixed(6)}</strong>
              </span>
              <span className="text-zinc-400">•</span>
              <span>
                Lng: <strong>{Number(currentLng).toFixed(6)}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCoords}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-[11px] font-semibold transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? "Copied!" : "Copy"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.flyTo([currentLat, currentLng], 17);
                }
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[11px] font-semibold border border-orange-500/20 transition cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Re-center</span>
            </button>
          </div>
        </div>
      </div>

      {/* Manual Coordinate Fine-Tuning */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
            Latitude (e.g. 12.9698)
          </label>
          <input
            type="number"
            step="0.000001"
            value={currentLat || ""}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setCurrentLat(val);
              applyCoordinates(val, currentLng);
              if (mapInstanceRef.current && isValidCoordinate(val, currentLng)) {
                mapInstanceRef.current.panTo([val, currentLng]);
              }
            }}
            className="w-full px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-white font-mono text-xs outline-none focus:border-orange-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
            Longitude (e.g. 79.1550)
          </label>
          <input
            type="number"
            step="0.000001"
            value={currentLng || ""}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setCurrentLng(val);
              applyCoordinates(currentLat, val);
              if (mapInstanceRef.current && isValidCoordinate(currentLat, val)) {
                mapInstanceRef.current.panTo([currentLat, val]);
              }
            }}
            className="w-full px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-white font-mono text-xs outline-none focus:border-orange-500"
          />
        </div>
      </div>
    </div>
  );
}
