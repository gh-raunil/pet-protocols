"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  MapPin,
  Crosshair,
  X,
  Check,
  AlertCircle,
  Loader2,
  Layers,
  ChevronDown,
  Navigation,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

const MAP_STYLES = [
  {
    id: "default",
    name: "Default Map",
    subtext: "Standard Street View",
    icon: "🗺️",
    base: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    overlay: null,
    maxZoom: 19,
  },
  {
    id: "hybrid",
    name: "Hybrid Map",
    subtext: "Satellite Imagery & Roads",
    icon: "🛰️",
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    subdomains: "abc",
    overlay: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
  },
  {
    id: "night",
    name: "Night Mode",
    subtext: "Dark High-Contrast",
    icon: "🌙",
    base: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    overlay: null,
    maxZoom: 19,
  },
  {
    id: "grey",
    name: "Grey Mode",
    subtext: "Sublime Minimal Grey",
    icon: "🏙️",
    base: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    overlay: null,
    maxZoom: 19,
  },
];

export default function DeliveryLocationMapPicker({
  isOpen,
  onClose,
  onSelectLocation,
  initialCoordinates = null,
}) {
  const [selectedCoords, setSelectedCoords] = useState(initialCoordinates || null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [activeStyle, setActiveStyle] = useState("default");
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const baseLayerRef = useRef(null);
  const overlayLayerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const resizeObserverRef = useRef(null);

  // Sync initial coordinates when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialCoordinates && typeof initialCoordinates.latitude === "number") {
        setSelectedCoords(initialCoordinates);
      }
      setGeoError("");
    }
  }, [isOpen, initialCoordinates]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    let isCancelled = false;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;

      const L = (await import("leaflet")).default;
      if (isCancelled || !containerRef.current) return;

      const initLat = selectedCoords?.latitude || 28.6139; // Delhi fallback
      const initLng = selectedCoords?.longitude || 77.209;

      const map = L.map(containerRef.current, {
        center: [initLat, initLng],
        zoom: selectedCoords ? 17 : 14,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Add default tile layer
      const styleConfig = MAP_STYLES.find((s) => s.id === activeStyle) || MAP_STYLES[0];
      baseLayerRef.current = L.tileLayer(styleConfig.base, {
        maxZoom: styleConfig.maxZoom,
        subdomains: styleConfig.subdomains || "abc",
      }).addTo(map);

      if (styleConfig.overlay) {
        overlayLayerRef.current = L.tileLayer(styleConfig.overlay, {
          maxZoom: styleConfig.maxZoom,
          subdomains: styleConfig.subdomains || "abc",
        }).addTo(map);
      }

      // Map move events to update center pin
      map.on("movestart", () => {
        setIsMapMoving(true);
      });

      map.on("move", () => {
        const center = map.getCenter();
        setSelectedCoords({
          latitude: center.lat,
          longitude: center.lng,
        });
      });

      map.on("moveend", () => {
        setIsMapMoving(false);
        const center = map.getCenter();
        setSelectedCoords({
          latitude: center.lat,
          longitude: center.lng,
        });
      });

      // Clicking anywhere pans map center to clicked point
      map.on("click", (e) => {
        if (e && e.latlng) {
          map.panTo(e.latlng, { animate: true });
        }
      });

      mapRef.current = map;
      setMapReady(true);

      // If initial coordinates exist, pan to them
      if (selectedCoords?.latitude && selectedCoords?.longitude) {
        map.setView([selectedCoords.latitude, selectedCoords.longitude], 17);
      } else {
        // Trigger auto-locate on initial open if no coordinates
        handleLocateMe();
      }

      // Attach ResizeObserver to handle modal transitions smoothly
      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        const ro = new ResizeObserver(() => {
          if (mapRef.current) {
            try {
              mapRef.current.invalidateSize();
            } catch {}
          }
        });
        ro.observe(containerRef.current);
        resizeObserverRef.current = ro;
      }

      // Staggered invalidateSize passes to guarantee full tile coverage
      [50, 150, 300, 600].forEach((delay) => {
        setTimeout(() => {
          if (mapRef.current) {
            try {
              mapRef.current.invalidateSize();
            } catch {}
          }
        }, delay);
      });
    }

    initMap();

    return () => {
      isCancelled = true;
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, [isOpen]);

  // Update Layer Style
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof window === "undefined") return;

    import("leaflet").then(({ default: L }) => {
      if (baseLayerRef.current) {
        map.removeLayer(baseLayerRef.current);
      }
      if (overlayLayerRef.current) {
        map.removeLayer(overlayLayerRef.current);
        overlayLayerRef.current = null;
      }

      const styleConfig = MAP_STYLES.find((s) => s.id === activeStyle) || MAP_STYLES[0];
      baseLayerRef.current = L.tileLayer(styleConfig.base, {
        maxZoom: styleConfig.maxZoom,
        subdomains: styleConfig.subdomains || "abc",
      }).addTo(map);

      if (styleConfig.overlay) {
        overlayLayerRef.current = L.tileLayer(styleConfig.overlay, {
          maxZoom: styleConfig.maxZoom,
          subdomains: styleConfig.subdomains || "abc",
        }).addTo(map);
      }
    });
  }, [activeStyle]);

  // Request browser GPS position (Point 6: Real-time device location)
  const handleLocateMe = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    setLocatingUser(true);
    setGeoError("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingUser(false);
        const { latitude, longitude, accuracy } = pos.coords;

        setSelectedCoords({ latitude, longitude, accuracy });

        const map = mapRef.current;
        if (map) {
          map.flyTo([latitude, longitude], 17, {
            animate: true,
            duration: 1.5,
          });

          // Draw accuracy circle
          import("leaflet").then(({ default: L }) => {
            if (accuracyCircleRef.current) {
              map.removeLayer(accuracyCircleRef.current);
            }
            if (accuracy && accuracy < 600) {
              accuracyCircleRef.current = L.circle([latitude, longitude], {
                radius: accuracy,
                color: "#10B981",
                fillColor: "#10B981",
                fillOpacity: 0.12,
                weight: 1.5,
              }).addTo(map);
            }
          });
        }
      },
      (err) => {
        setLocatingUser(false);
        if (err.code === 1) {
          setGeoError("Location access denied. Please allow GPS permission in your browser.");
        } else {
          setGeoError("Unable to acquire device GPS position. Move map manually to drop pin.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, []);

  // Confirm selection
  const handleConfirm = () => {
    if (selectedCoords) {
      onSelectLocation(selectedCoords);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[var(--bg-card,#141518)] border border-[var(--border-color,rgba(255,255,255,0.1))] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--border-color,rgba(255,255,255,0.1))] bg-[var(--bg-main,#0D0E10)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <MapPin size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                Pin Delivery Location on Map
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-400 mt-0.5">
                Drag the map or click &quot;Use My GPS&quot; to place your exact doorstep pin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Map Container with Center Pin Overlay */}
        <div className="relative w-full h-[360px] sm:h-[420px] bg-stone-900 overflow-hidden">
          <div ref={containerRef} className="w-full h-full" />

          {/* Fixed Center Pin Overlay (Point 5: Marked doorstep pin with exact 50% anchor) */}
          <div
            className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible"
            style={{ zIndex: 1000 }}
          >
            {/* The pin itself: anchored so its bottom tip is at 50% 50% */}
            <div
              className="flex flex-col items-center pointer-events-none select-none transition-transform duration-150 ease-out"
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: isMapMoving
                  ? "translate(-50%, -108%) scale(1.05)"
                  : "translate(-50%, -100%)",
              }}
            >
              {/* Floating label */}
              <div className="mb-1 px-2.5 py-1 rounded-full bg-stone-900/95 border border-emerald-500/40 text-[10px] font-extrabold text-white shadow-xl flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Delivery Doorstep Pin</span>
              </div>

              {/* Pin Graphics */}
              <div className="flex flex-col items-center">
                <div className="w-9 h-9 rounded-full bg-emerald-500 border-2 border-white shadow-2xl flex items-center justify-center text-white text-sm font-black">
                  🏠
                </div>
                <div className="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[11px] border-t-emerald-500 -mt-0.5" />
              </div>
            </div>

            {/* Shadow at pin base: stays anchored on the ground at (50%, 50%) */}
            <div
              className="rounded-full bg-black/60 blur-[1px] transition-all duration-150 pointer-events-none"
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: isMapMoving ? "8px" : "14px",
                height: isMapMoving ? "3px" : "5px",
                transform: "translate(-50%, -50%)",
                opacity: isMapMoving ? 0.35 : 0.8,
              }}
            />
          </div>

          {/* Top-Right Control Buttons: GPS & Layer Switcher */}
          <div
            className="absolute top-3 right-3 flex flex-col gap-2"
            style={{ zIndex: 1000 }}
          >
            {/* Use My GPS Button (Point 6) */}
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={locatingUser}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-stone-100 text-stone-900 font-extrabold text-xs shadow-xl transition cursor-pointer border border-stone-200"
            >
              {locatingUser ? (
                <Loader2 size={14} className="animate-spin text-emerald-600" />
              ) : (
                <Crosshair size={14} className="text-emerald-600" />
              )}
              <span>{locatingUser ? "Locating..." : "Use My GPS"}</span>
            </button>

            {/* Layer Switcher Button */}
            <div className="relative self-end">
              <button
                type="button"
                onClick={() => setStyleMenuOpen(!styleMenuOpen)}
                className="w-9 h-9 rounded-xl bg-stone-900/90 hover:bg-stone-900 text-white border border-white/20 shadow-xl flex items-center justify-center transition cursor-pointer"
                title="Change Map Style"
              >
                <Layers size={15} className="text-blue-400" />
              </button>

              {/* Layer Menu Popup */}
              {styleMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-stone-900 border border-white/15 p-2 shadow-2xl"
                  style={{ zIndex: 1050 }}
                >
                  <div className="px-2 py-1 text-[10px] font-extrabold uppercase text-stone-400 border-b border-white/10 mb-1">
                    Map Style
                  </div>
                  {MAP_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => {
                        setActiveStyle(style.id);
                        setStyleMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                        activeStyle === style.id
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "text-stone-300 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{style.icon}</span>
                        <div>
                          <div className="leading-tight">{style.name}</div>
                          <div className="text-[10px] text-stone-400 font-normal">{style.subtext}</div>
                        </div>
                      </div>
                      {activeStyle === style.id && <Check size={13} className="text-emerald-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Instructions banner */}
          <div
            className="absolute bottom-2 left-3 pointer-events-none"
            style={{ zIndex: 1000 }}
          >
            <span className="px-2.5 py-1 rounded-lg bg-stone-900/85 backdrop-blur-xs text-[10px] font-semibold text-stone-300 border border-white/10 shadow-sm">
              💡 Move map or tap to align the doorstep pin
            </span>
          </div>
        </div>

        {/* Error message if geolocation fails */}
        {geoError && (
          <div className="px-4 py-2 bg-rose-500/10 border-t border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{geoError}</span>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 bg-[var(--bg-main,#0D0E10)] border-t border-[var(--border-color,rgba(255,255,255,0.1))] flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {selectedCoords ? (
              <>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {Number(selectedCoords.latitude).toFixed(5)}, {Number(selectedCoords.longitude).toFixed(5)}
                </span>
                {selectedCoords.accuracy && (
                  <span className="text-[11px] text-stone-400 font-medium">
                    (Accuracy: ~{Math.round(selectedCoords.accuracy)}m)
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs text-stone-500 italic">No coordinates selected</span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-stone-300 hover:bg-white/5 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedCoords}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Check size={14} />
              <span>Confirm Location Pin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
