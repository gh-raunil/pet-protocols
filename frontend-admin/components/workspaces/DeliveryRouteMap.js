"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Layers,
  Crosshair,
  ExternalLink,
  Navigation,
  MapPin,
  Check,
  ChevronDown,
  Loader2,
  Sparkles,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

const MAP_STYLES = [
  {
    id: "hybrid",
    name: "Hybrid Map",
    subtext: "Satellite Imagery & Roads",
    icon: "🛰️",
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    subdomains: "abc",
    overlay: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ",
    maxZoom: 19,
  },
  {
    id: "default",
    name: "Default Map",
    subtext: "Standard Street View",
    icon: "🗺️",
    base: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    overlay: null,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
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
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  },
];

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function DeliveryRouteMap({
  origin = null, // { lat, lng, heading } (staff location)
  destination = null, // { lat, lng } (doorstep pin)
  customerLocation = null, // optional { latitude, longitude, accuracy }
  orderId = "",
  recipientName = "",
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const baseLayerRef = useRef(null);
  const overlayLayerRef = useRef(null);
  const staffMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const customerMarkerRef = useRef(null);
  const routeLineRef = useRef(null);

  const [activeStyle, setActiveStyle] = useState("hybrid");
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [routeStats, setRouteStats] = useState({ distanceKm: null, etaMins: null });
  const [mapReady, setMapReady] = useState(false);
  const [deviceCoords, setDeviceCoords] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [menuCoords, setMenuCoords] = useState(null);
  const layerButtonRef = useRef(null);
  const mapLayerBtnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuPosition = useCallback(() => {
    const target = layerButtonRef.current || mapLayerBtnRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setStyleMenuOpen(false);
      return;
    }
    setMenuCoords({
      top: Math.round(rect.bottom + 8),
      right: Math.max(12, Math.round(window.innerWidth - rect.right)),
    });
  }, []);

  useEffect(() => {
    if (styleMenuOpen) {
      updateMenuPosition();
      const handleScrollOrResize = () => updateMenuPosition();
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
      return () => {
        window.removeEventListener("scroll", handleScrollOrResize, true);
        window.removeEventListener("resize", handleScrollOrResize);
      };
    }
  }, [styleMenuOpen, updateMenuPosition]);

  // Handle outside click & ESC key to close layer dropdown
  useEffect(() => {
    if (!styleMenuOpen) return;

    const handleClickOutside = (e) => {
      if (
        (layerButtonRef.current && layerButtonRef.current.contains(e.target)) ||
        (mapLayerBtnRef.current && mapLayerBtnRef.current.contains(e.target))
      ) {
        return;
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setStyleMenuOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setStyleMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [styleMenuOpen]);

  const destLat = destination?.lat || destination?.latitude;
  const destLng = destination?.lng || destination?.longitude;
  const staffLat = origin?.lat || origin?.latitude || deviceCoords?.lat;
  const staffLng = origin?.lng || origin?.longitude || deviceCoords?.lng;

  // Auto-acquire staff device GPS location if origin is not provided
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;

    // Fast initial position fix
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeviceCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        console.warn("Could not acquire initial staff GPS position:", err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    // Watch position for continuous updates as delivery staff rides
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDeviceCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        console.warn("Staff live GPS watch warning:", err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    let isCancelled = false;

    async function initMap() {
      if (!containerRef.current || mapRef.current || typeof window === "undefined") return;

      const L = (await import("leaflet")).default;
      if (isCancelled || !containerRef.current) return;

      const defaultCenter = [
        staffLat || destLat || 12.97,
        staffLng || destLng || 79.15,
      ];

      const map = L.map(containerRef.current, {
        center: defaultCenter,
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Add base layer
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

      mapRef.current = map;
      setMapReady(true);

      // Invalidate size on mount & transitions
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
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer when activeStyle changes
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

  // Update Markers and Route Polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || typeof window === "undefined") return;

    import("leaflet").then(({ default: L }) => {
      const boundsCoords = [];

      // 1. Staff Marker
      if (staffLat && staffLng) {
        const staffPos = [staffLat, staffLng];
        boundsCoords.push(staffPos);

        const staffIcon = L.divIcon({
          className: "delivery-staff-marker",
          html: `
            <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
              <span style="position:absolute; width:44px; height:44px; border-radius:50%; background:rgba(37,99,235,0.25); animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></span>
              <div style="position:relative; width:34px; height:34px; border-radius:50%; background:#2563EB; border:3px solid #FFFFFF; box-shadow:0 4px 10px rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-size:16px;">
                🛵
              </div>
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });

        if (!staffMarkerRef.current) {
          staffMarkerRef.current = L.marker(staffPos, { icon: staffIcon })
            .addTo(map)
            .bindPopup(`<div style="font-family:sans-serif;font-size:12px;font-weight:bold;">🛵 Delivery Staff (You)</div>`);
        } else {
          staffMarkerRef.current.setLatLng(staffPos);
        }
      }

      // 2. Doorstep Destination Marker
      if (destLat && destLng) {
        const destPos = [destLat, destLng];
        boundsCoords.push(destPos);

        const destIcon = L.divIcon({
          className: "delivery-dest-marker",
          html: `
            <div style="position:relative; width:46px; height:50px; display:flex; flex-direction:column; align-items:center;">
              <div style="width:36px; height:36px; border-radius:50%; background:#EF4444; border:3px solid #FFFFFF; box-shadow:0 4px 12px rgba(239,68,68,0.5); display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-size:17px;">
                🏠
              </div>
              <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:10px solid #EF4444; margin-top:-2px;"></div>
            </div>
          `,
          iconSize: [46, 50],
          iconAnchor: [23, 48],
        });

        if (!destMarkerRef.current) {
          destMarkerRef.current = L.marker(destPos, { icon: destIcon })
            .addTo(map)
            .bindPopup(`<div style="font-family:sans-serif;font-size:12px;font-weight:bold;">📍 Delivery Doorstep<br/><span style="font-size:11px;font-weight:normal;color:#666;">${recipientName || "Customer"}</span></div>`);
        } else {
          destMarkerRef.current.setLatLng(destPos);
        }
      }

      // 3. Customer Live Location Marker (if customer is sharing live GPS)
      const custLat = customerLocation?.latitude;
      const custLng = customerLocation?.longitude;
      if (custLat && custLng) {
        const custPos = [custLat, custLng];
        boundsCoords.push(custPos);

        const custIcon = L.divIcon({
          className: "customer-live-marker",
          html: `
            <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
              <span style="position:absolute; width:36px; height:36px; border-radius:50%; background:rgba(16,185,129,0.35); animation:pulse 1.5s infinite;"></span>
              <div style="width:22px; height:22px; border-radius:50%; background:#10B981; border:2.5px solid #FFFFFF; box-shadow:0 2px 8px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-size:11px;">
                🎯
              </div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        if (!customerMarkerRef.current) {
          customerMarkerRef.current = L.marker(custPos, { icon: custIcon })
            .addTo(map)
            .bindPopup(`<div style="font-family:sans-serif;font-size:12px;font-weight:bold;">🎯 Customer Live GPS<br/><span style="font-size:10px;color:#10B981;">Real-time Handshake Active</span></div>`);
        } else {
          customerMarkerRef.current.setLatLng(custPos);
        }
      }

      // 4. Draw Route Polyline from Staff to Destination
      if (staffLat && staffLng && destLat && destLng) {
        const directDist = haversineDistance(staffLat, staffLng, destLat, destLng);
        const estMinutes = Math.max(1, Math.round((directDist / 22) * 60 + 2)); // ~22km/h city bike avg
        setRouteStats({ distanceKm: directDist.toFixed(1), etaMins: estMinutes });

        // Immediate straight-line route fallback so the route is NEVER invisible
        const immediateLine = [
          [staffLat, staffLng],
          [destLat, destLng],
        ];
        renderRoute(immediateLine, L, map);

        // Fetch OSRM turn-by-turn driving polyline
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${staffLng},${staffLat};${destLng},${destLat}?overview=full&geometries=geojson`;

        fetch(osrmUrl)
          .then((res) => res.json())
          .then((data) => {
            if (data?.routes?.[0]?.geometry?.coordinates) {
              const roadCoords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
              if (data.routes[0].distance) {
                const roadDist = data.routes[0].distance / 1000;
                const roadDuration = Math.round(data.routes[0].duration / 60);
                setRouteStats({
                  distanceKm: roadDist.toFixed(1),
                  etaMins: Math.max(1, roadDuration),
                });
              }
              renderRoute(roadCoords, L, map);
            }
          })
          .catch(() => {
            // Keep immediate fallback
          });
      }

      // 5. Fit bounds with padding
      if (boundsCoords.length > 1) {
        try {
          map.fitBounds(L.latLngBounds(boundsCoords), {
            padding: [45, 45],
            maxZoom: 17,
          });
        } catch {}
      } else if (boundsCoords.length === 1) {
        map.setView(boundsCoords[0], 16);
      }
    });
  }, [mapReady, staffLat, staffLng, destLat, destLng, customerLocation, recipientName]);

  const renderRoute = (latlngs, L, map) => {
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
    }

    routeLineRef.current = L.polyline(latlngs, {
      color: "#2563EB",
      weight: 5,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round",
      dashArray: null,
    }).addTo(map);
  };

  const handleFitRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map || typeof window === "undefined") return;

    import("leaflet").then(({ default: L }) => {
      const points = [];
      if (staffLat && staffLng) points.push([staffLat, staffLng]);
      if (destLat && destLng) points.push([destLat, destLng]);
      if (customerLocation?.latitude && customerLocation?.longitude) {
        points.push([customerLocation.latitude, customerLocation.longitude]);
      }

      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
      } else if (points.length === 1) {
        map.setView(points[0], 16);
      }
    });
  }, [staffLat, staffLng, destLat, destLng, customerLocation]);

  return (
    <div className="mt-2.5 rounded-2xl border border-blue-500/30 bg-stone-950 shadow-xl relative" style={{ overflow: "visible" }}>
      {/* Top Map Toolbar */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5 bg-stone-900/95 border-b border-white/10 text-xs rounded-t-2xl relative"
        style={{ zIndex: 30 }}
      >
        <div className="flex items-center gap-2 font-bold text-white text-[11px]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>Live Route to Doorstep</span>
          {routeStats.distanceKm && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono text-[10px]">
              {routeStats.distanceKm} km • ~{routeStats.etaMins} mins
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Layer Switcher Button (Toolbar) */}
          <div className="relative">
            <button
              ref={layerButtonRef}
              type="button"
              onClick={() => {
                if (!styleMenuOpen && layerButtonRef.current) {
                  const rect = layerButtonRef.current.getBoundingClientRect();
                  setMenuCoords({
                    top: Math.round(rect.bottom + 8),
                    right: Math.max(12, Math.round(window.innerWidth - rect.right)),
                  });
                }
                setStyleMenuOpen(!styleMenuOpen);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-stone-200 border text-[11px] font-bold transition cursor-pointer ${
                styleMenuOpen
                  ? "bg-stone-700 border-blue-400/50 text-white shadow-xs"
                  : "bg-stone-800 hover:bg-stone-700 border-white/10"
              }`}
              title="Change Map Layer Style"
            >
              <Layers size={12} className="text-blue-400" />
              <span>Layers</span>
              <ChevronDown size={11} className={`transition-transform duration-200 ${styleMenuOpen ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* External Google Maps app button */}
          {destLat && destLng && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 transition underline underline-offset-2"
              title="Open full Google Maps App for turn-by-turn spoken audio navigation"
            >
              <span>Maps App</span>
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>

      {/* Interactive Map Viewport */}
      <div className="relative w-full h-[320px] bg-stone-900 rounded-b-2xl overflow-hidden" style={{ zIndex: 0 }}>
        <div ref={containerRef} className="w-full h-full" />

        {/* Quick Map Overlay Action Buttons */}
        <div className="absolute top-3 right-3 z-30 flex flex-col gap-1.5" style={{ zIndex: 1000 }}>
          <button
            type="button"
            onClick={handleFitRoute}
            className="w-8 h-8 rounded-xl bg-stone-900/90 hover:bg-stone-900 text-white border border-white/20 shadow-lg flex items-center justify-center transition cursor-pointer"
            title="Recenter and Fit Full Route"
          >
            <Crosshair size={14} className="text-blue-400" />
          </button>

          <button
            ref={mapLayerBtnRef}
            type="button"
            onClick={() => {
              if (!styleMenuOpen && mapLayerBtnRef.current) {
                const rect = mapLayerBtnRef.current.getBoundingClientRect();
                setMenuCoords({
                  top: Math.round(rect.bottom + 8),
                  right: Math.max(12, Math.round(window.innerWidth - rect.right)),
                });
              }
              setStyleMenuOpen(!styleMenuOpen);
            }}
            className={`w-8 h-8 rounded-xl bg-stone-900/90 hover:bg-stone-900 border shadow-lg flex items-center justify-center transition cursor-pointer ${
              styleMenuOpen ? "border-blue-400 text-blue-400" : "border-white/20 text-white"
            }`}
            title="Switch Map Tile Layer Style"
          >
            <Layers size={14} className="text-blue-400" />
          </button>
        </div>

        {/* Legend pills */}
        <div className="absolute bottom-2 left-2 z-30 flex items-center gap-1.5 flex-wrap pointer-events-none">
          <span className="px-2 py-0.5 rounded-md bg-stone-900/90 border border-white/10 text-[10px] font-bold text-white shadow-sm flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> You (Staff)
          </span>
          <span className="px-2 py-0.5 rounded-md bg-stone-900/90 border border-white/10 text-[10px] font-bold text-white shadow-sm flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span> Doorstep Pin
          </span>
          {customerLocation && (
            <span className="px-2 py-0.5 rounded-md bg-stone-900/90 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 shadow-sm flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Customer Live
            </span>
          )}
        </div>
      </div>

      {/* Footer Info Bar */}
      <div className="px-3.5 py-1.5 bg-stone-900/95 border-t border-white/5 flex items-center justify-between text-[10px] text-stone-400">
        <span className="font-mono">
          📍 Pin: {Number(destLat).toFixed(5)}, {Number(destLng).toFixed(5)}
        </span>
        <span className="text-emerald-400 font-bold">Touch / Pinch / Drag Active</span>
      </div>

      {/* Layer Switcher Popup Menu (Rendered via React Portal directly into document.body to ensure it floats 100% on top of all map tiles and containers) */}
      {mounted && styleMenuOpen && menuCoords && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: `${menuCoords.top}px`,
            right: `${menuCoords.right}px`,
            zIndex: 999999,
          }}
          className="w-56 rounded-2xl bg-stone-900/98 backdrop-blur-md border border-white/20 p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-stone-400 border-b border-white/10 mb-1 flex items-center justify-between">
            <span>Map Style</span>
            <span className="text-[9px] text-blue-400 font-bold uppercase">{activeStyle}</span>
          </div>
          <div className="space-y-1">
            {MAP_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => {
                  setActiveStyle(style.id);
                  setStyleMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                  activeStyle === style.id
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "text-stone-300 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{style.icon}</span>
                  <div>
                    <div className="leading-tight">{style.name}</div>
                    <div className="text-[10px] text-stone-400 font-normal leading-tight">{style.subtext}</div>
                  </div>
                </div>
                {activeStyle === style.id && <Check size={14} className="text-blue-400 shrink-0" />}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
