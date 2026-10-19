"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { MapPin, Crosshair, X, Check, AlertCircle, Loader2 } from "lucide-react";

const PIN_ICON_SVG = `data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="%2310B981" stroke="%23FFFFFF" stroke-width="3"/><path d="M24 13c-4.4 0-8 3.6-8 8 0 5.3 8 14 8 14s8-8.7 8-14c0-4.4-3.6-8-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" fill="%23FFFFFF"/></svg>`;

export default function DeliveryLocationMapPicker({
  isOpen,
  onClose,
  onSelectLocation,
  initialCoordinates = null,
}) {
  const [selectedCoords, setSelectedCoords] = useState(initialCoordinates || null);
  const [sdkStatus, setSdkStatus] = useState("idle"); // "idle" | "loading" | "ready" | "error"
  const [locatingUser, setLocatingUser] = useState(false);
  const [geoError, setGeoError] = useState("");

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const mapKey = process.env.NEXT_PUBLIC_MAPPLS_MAP_KEY;

  // Sync initial coordinates when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialCoordinates && typeof initialCoordinates.latitude === "number") {
        setSelectedCoords(initialCoordinates);
      }
      setGeoError("");
    }
  }, [isOpen, initialCoordinates]);

  // Load Mappls SDK if not loaded
  useEffect(() => {
    if (!isOpen) return;

    if (!mapKey) {
      setSdkStatus("error");
      return;
    }

    if (window.mappls && typeof window.mappls.Map === "function") {
      setSdkStatus("ready");
      return;
    }

    setSdkStatus("loading");
    const scriptId = "mappls-maps-sdk-script";
    let script = document.getElementById(scriptId);

    const timeoutId = setTimeout(() => {
      setSdkStatus((current) => (current === "loading" ? "error" : current));
    }, 8000);

    const loadScriptWithFallback = (src, fallbackSrc) => {
      const existing = document.getElementById(scriptId);
      if (existing) existing.remove();

      const newScript = document.createElement("script");
      newScript.id = scriptId;
      newScript.src = src;
      newScript.async = true;

      newScript.onload = () => {
        clearTimeout(timeoutId);
        if (window.mappls && typeof window.mappls.Map === "function") {
          setSdkStatus("ready");
        } else if (fallbackSrc) {
          loadScriptWithFallback(fallbackSrc, null);
        } else {
          setSdkStatus("error");
        }
      };

      newScript.onerror = () => {
        if (fallbackSrc) {
          loadScriptWithFallback(fallbackSrc, null);
        } else {
          clearTimeout(timeoutId);
          setSdkStatus("error");
        }
      };

      document.head.appendChild(newScript);
    };

    if (!script) {
      loadScriptWithFallback(
        `https://apis.mappls.com/advancedmaps/api/${encodeURIComponent(mapKey)}/map_sdk?v=3.0&layer=vector`,
        `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${encodeURIComponent(mapKey)}`
      );
    } else {
      const checkInterval = setInterval(() => {
        if (window.mappls && typeof window.mappls.Map === "function") {
          clearTimeout(timeoutId);
          clearInterval(checkInterval);
          setSdkStatus("ready");
        }
      }, 200);
      return () => {
        clearTimeout(timeoutId);
        clearInterval(checkInterval);
      };
    }

    return () => clearTimeout(timeoutId);
  }, [isOpen, mapKey]);

  // Handle setting a pin coordinate
  const setPinAt = useCallback((lat, lng) => {
    setSelectedCoords({ latitude: lat, longitude: lng });

    const map = mapInstanceRef.current;
    if (!map || !window.mappls) return;

    const pos = { lat, lng };
    if (!markerRef.current) {
      try {
        markerRef.current = new window.mappls.Marker({
          map,
          position: pos,
          icon: PIN_ICON_SVG,
          width: 40,
          height: 40,
          draggable: true,
        });

        // Listen for marker dragend
        if (typeof markerRef.current.addListener === "function") {
          markerRef.current.addListener("dragend", (e) => {
            if (e && e.target && typeof e.target.getPosition === "function") {
              const p = e.target.getPosition();
              if (p && typeof p.lat === "number" && typeof p.lng === "number") {
                setSelectedCoords({ latitude: p.lat, longitude: p.lng });
              }
            }
          });
        }
      } catch (e) {
        console.warn("Could not create map marker:", e);
      }
    } else {
      try {
        markerRef.current.setPosition(pos);
      } catch {}
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!isOpen || sdkStatus !== "ready" || !mapContainerRef.current || !window.mappls) return;

    const defaultLat = selectedCoords?.latitude || 28.6139;
    const defaultLng = selectedCoords?.longitude || 77.209;

    if (!mapInstanceRef.current) {
      try {
        const container = mapContainerRef.current;
        if (!container.id) {
          container.id = "mappls-checkout-picker-canvas";
        }

        const map = new window.mappls.Map(container.id, {
          center: [defaultLat, defaultLng],
          zoom: selectedCoords ? 16 : 13,
          placemark: false,
          zoomControl: true,
          hybrid: false,
        });

        mapInstanceRef.current = map;

        // Map click sets location
        map.on("click", (e) => {
          if (e && e.lngLat) {
            const lat = typeof e.lngLat.lat === "function" ? e.lngLat.lat() : e.lngLat.lat;
            const lng = typeof e.lngLat.lng === "function" ? e.lngLat.lng() : e.lngLat.lng;
            if (typeof lat === "number" && typeof lng === "number") {
              setPinAt(lat, lng);
            }
          }
        });

        // If initial coords exist, place marker
        if (selectedCoords?.latitude && selectedCoords?.longitude) {
          setPinAt(selectedCoords.latitude, selectedCoords.longitude);
        }
      } catch (err) {
        console.warn("Mappls picker initialization error:", err);
      }
    } else {
      try {
        mapInstanceRef.current.resize();
        if (selectedCoords?.latitude && selectedCoords?.longitude) {
          setPinAt(selectedCoords.latitude, selectedCoords.longitude);
          mapInstanceRef.current.setCenter([selectedCoords.latitude, selectedCoords.longitude]);
        }
      } catch {}
    }
  }, [isOpen, sdkStatus, selectedCoords, setPinAt]);

  // Request browser GPS position
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
        const { latitude, longitude } = pos.coords;
        setPinAt(latitude, longitude);

        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.setCenter([latitude, longitude]);
            mapInstanceRef.current.setZoom(16);
          } catch {}
        }
      },
      (err) => {
        setLocatingUser(false);
        if (err.code === 1) {
          setGeoError("Location access denied. Please allow location permissions in your browser.");
        } else {
          setGeoError("Unable to acquire device GPS position. Please tap on the map to pin.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
  }, [setPinAt]);

  // Confirm selection
  const handleConfirm = () => {
    if (selectedCoords) {
      onSelectLocation(selectedCoords);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-picker-title"
    >
      <div className="relative w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-color)] flex items-center justify-between gap-3 bg-[var(--bg-sub)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
              <MapPin size={20} />
            </div>
            <div>
              <h3 id="map-picker-title" className="text-base font-extrabold text-[var(--text-main)]">
                Pin Delivery Location on Map
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Tap anywhere on the map or use your GPS to drop an exact doorstep delivery pin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-color)]/20 transition cursor-pointer"
            aria-label="Close map"
          >
            <X size={18} />
          </button>
        </div>

        {/* Map Container */}
        <div className="relative flex-1 min-h-[340px] sm:min-h-[400px] w-full bg-[var(--bg-sub)]">
          {sdkStatus === "loading" && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[var(--bg-card)]/80 backdrop-blur-xs gap-3">
              <Loader2 size={32} className="animate-spin text-emerald-500" />
              <span className="text-xs font-semibold text-[var(--text-muted)]">Loading Mappls interactive map...</span>
            </div>
          )}

          {sdkStatus === "error" && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-[var(--bg-card)]/95 gap-3">
              <AlertCircle size={36} className="text-amber-500" />
              <h4 className="text-sm font-bold text-[var(--text-main)]">Map Preview Currently Unavailable</h4>
              <p className="text-xs text-[var(--text-muted)] max-w-md">
                You can still use your current device GPS position directly by clicking the button below, or proceed with your written address.
              </p>
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={locatingUser}
                className="mt-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md"
              >
                {locatingUser ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
                <span>Capture My Current GPS Position</span>
              </button>
            </div>
          )}

          <div
            ref={mapContainerRef}
            id="mappls-checkout-picker-canvas"
            className="w-full h-full min-h-[340px] sm:min-h-[400px]"
          />

          {/* Floating "Locate Me" button */}
          {sdkStatus === "ready" && (
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={locatingUser}
              className="absolute top-4 right-4 z-10 px-3.5 py-2.5 rounded-2xl bg-[var(--bg-card)]/95 text-[var(--text-main)] hover:bg-[var(--bg-card)] border border-[var(--border-color)] shadow-lg hover:shadow-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer backdrop-blur-xs active:scale-95"
              title="Pin my current GPS location"
            >
              {locatingUser ? (
                <Loader2 size={15} className="animate-spin text-emerald-500" />
              ) : (
                <Crosshair size={15} className="text-emerald-500" />
              )}
              <span>{locatingUser ? "Locating..." : "Use My GPS"}</span>
            </button>
          )}

          {geoError && (
            <div className="absolute top-4 left-4 right-16 z-10 p-2.5 rounded-xl bg-rose-500/90 text-white text-xs font-medium shadow-lg flex items-center gap-2 backdrop-blur-xs">
              <AlertCircle size={15} className="shrink-0" />
              <span className="truncate">{geoError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[var(--border-color)] bg-[var(--bg-sub)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[var(--text-muted)] flex items-center gap-2 w-full sm:w-auto">
            {selectedCoords ? (
              <span className="font-mono bg-[var(--bg-card)] px-2.5 py-1 rounded-lg border border-[var(--border-color)] text-emerald-500 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {selectedCoords.latitude.toFixed(5)}, {selectedCoords.longitude.toFixed(5)}
              </span>
            ) : (
              <span className="italic">No pin placed yet. Tap map or click &quot;Use My GPS&quot;.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs font-semibold hover:bg-[var(--bg-card)] transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedCoords}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md disabled:cursor-not-allowed"
            >
              <Check size={15} />
              <span>Confirm Location Pin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
