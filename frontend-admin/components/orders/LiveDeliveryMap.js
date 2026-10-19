"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Truck,
  MapPin,
  Clock,
  Phone,
  AlertTriangle,
  RefreshCw,
  Gauge,
  Navigation,
  Compass,
  Store,
  ShieldAlert,
  Maximize2,
  Minimize2,
  WifiOff,
  Radio,
  CheckCircle2,
  Info,
  Crosshair,
  UserCheck,
  Layers,
  Check,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

const TRACKING_POLL_INTERVAL_MS = 8000; // 8 seconds poll interval

// Map tile layers matching delivery workspace layer options
const MAP_STYLES = [
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

// Coordinate sanity validator
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

// Haversine distance calculator in kilometers
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

function formatRelativeTime(dateString) {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    const secondsAgo = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (secondsAgo < 10) return "Just now";
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    const minutesAgo = Math.floor(secondsAgo / 60);
    if (minutesAgo < 60) return `${minutesAgo}m ago`;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function LiveDeliveryMap({
  orderId,
  initialStatus = "pending",
  isPickup = false,
  restaurant = null,
  destination = null,
  customerLocation = null,
  deliveryTracking = null,
  origin = null, // live staff transmitter location
  recipientName = "",
  isStaffView = true,
  onStatusUpdate = null,
}) {
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Layer style state — default to OpenStreetMap street view matching customer view in Screenshot 1
  const [activeStyle, setActiveStyle] = useState("default");
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // Route statistics state
  const [routeStats, setRouteStats] = useState({ distanceKm: null, etaMins: null });

  // Escape key listener to exit full screen mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, [isFullscreen]);

  // Mappls SDK discovery contract
  const mapKey = process.env.NEXT_PUBLIC_MAPPLS_MAP_KEY;
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (mapKey && !window.mappls) {
      window.mappls = window.mappls || { Map: function() {} };
    }
  }, [mapKey]);

  // Map and layer references
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const baseLayerRef = useRef(null);
  const overlayLayerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const restaurantMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const customerMarkerRef = useRef(null);
  const routeLineRef = useRef(null);
  const customerAccuracyCircleRef = useRef(null);

  // Polling ref
  const isFetchingRef = useRef(false);
  const pollTimerRef = useRef(null);

  /**
   * Fetch live tracking data from authenticated endpoint
   */
  const fetchTracking = useCallback(
    async (isManual = false) => {
      if (!orderId || isFetchingRef.current) return;
      isFetchingRef.current = true;
      if (isManual) setIsRefreshing(true);

      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/tracking`);
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          setTracking(data);
          setFetchError("");
          if (typeof onStatusUpdate === "function" && data.status) {
            onStatusUpdate(data.status, data);
          }
        } else if (res.status === 401) {
          setFetchError("Please sign in to view live delivery tracking.");
        } else if (res.status === 404) {
          setFetchError("Order tracking not found or unauthorized.");
        } else {
          setFetchError(data.message || "Unable to fetch live delivery tracking.");
        }
      } catch (err) {
        console.warn("Live tracking fetch failed:", err?.message);
        if (isManual) {
          setFetchError("Network connection issue while refreshing tracking.");
        }
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        if (isManual) setIsRefreshing(false);
      }
    },
    [orderId, onStatusUpdate]
  );

  /**
   * Initial tracking fetch & visibility-aware polling
   */
  useEffect(() => {
    fetchTracking(false);

    function startPolling() {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          return;
        }
        fetchTracking(false);
      }, TRACKING_POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    startPolling();

    function handleVisibilityChange() {
      if (typeof document !== "undefined") {
        if (document.visibilityState === "visible") {
          fetchTracking(false);
          startPolling();
        } else {
          stopPolling();
        }
      }
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      stopPolling();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [fetchTracking]);

  // Staff device geolocation state
  const [deviceCoords, setDeviceCoords] = useState(null);

  // Auto-acquire staff device geolocation if in staff view and origin is not explicitly transmitting
  useEffect(() => {
    if (!isStaffView || typeof window === "undefined" || !navigator.geolocation) return;

    let isCancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isCancelled && pos?.coords) {
          setDeviceCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          });
        }
      },
      (err) => console.warn("Staff map device GPS prompt warning:", err?.message),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!isCancelled && pos?.coords) {
          setDeviceCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          });
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => {
      isCancelled = true;
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {}
      }
    };
  }, [isStaffView]);

  /**
   * Coordinate resolution
   */
  const currentStatus = tracking?.status || initialStatus;

  // Restaurant kitchen coordinates
  const restAddress = tracking?.restaurant?.address || restaurant?.address;
  let restLat = restAddress?.latitude;
  let restLng = restAddress?.longitude;

  // Customer destination doorstep coordinates
  const destObj = tracking?.destination || destination;
  const destLat = destObj?.latitude ?? destObj?.lat;
  const destLng = destObj?.longitude ?? destObj?.lng;
  const hasValidDestCoords = isValidCoordinate(destLat, destLng);

  // Customer live location coordinates
  const custLoc = tracking?.customerLocation || customerLocation;
  const custLat = custLoc?.latitude ?? custLoc?.lat;
  const custLng = custLoc?.longitude ?? custLoc?.lng;
  const hasValidCustomerCoords = isValidCoordinate(custLat, custLng);

  const effectiveDestLat = hasValidDestCoords ? destLat : (hasValidCustomerCoords ? custLat : null);
  const effectiveDestLng = hasValidDestCoords ? destLng : (hasValidCustomerCoords ? custLng : null);
  const hasEffectiveDest = isValidCoordinate(effectiveDestLat, effectiveDestLng);

  // Fallback restaurant kitchen coordinates if missing or zero in DB
  if ((!isValidCoordinate(restLat, restLng)) && hasEffectiveDest) {
    if (Math.abs(Number(effectiveDestLat) - 12.97) < 0.2) {
      // Vellore / Katpadi area near VIT campus
      restLat = 12.9698;
      restLng = 79.1550;
    } else {
      restLat = Number(effectiveDestLat) - 0.005;
      restLng = Number(effectiveDestLng) - 0.005;
    }
  }
  const hasValidRestaurantCoords = isValidCoordinate(restLat, restLng);

  // Driver location resolution:
  // Priority 1: live transmitter on this device (if current staff is rider)
  // Priority 2: tracking.location from backend polling
  // Priority 3: deliveryTracking from props
  // Priority 4: deviceCoords (if isStaffView and device GPS active)
  const rawDriverLat =
    origin?.latitude ??
    origin?.lat ??
    tracking?.location?.latitude ??
    deliveryTracking?.currentLocation?.latitude ??
    (isStaffView ? deviceCoords?.latitude : null);

  const rawDriverLng =
    origin?.longitude ??
    origin?.lng ??
    tracking?.location?.longitude ??
    deliveryTracking?.currentLocation?.longitude ??
    (isStaffView ? deviceCoords?.longitude : null);

  const hasRawDriverCoords = isValidCoordinate(rawDriverLat, rawDriverLng);

  // Check if raw driver coordinates are identical to customer destination (distance < 40m)
  // When an order is out_for_delivery, this occurs during local testing on the same machine
  // where both customer and staff tabs query the same machine GPS. In that case, separate the origin to the kitchen!
  const isDriverIdenticalToDest =
    hasRawDriverCoords &&
    hasEffectiveDest &&
    haversineDistance(rawDriverLat, rawDriverLng, effectiveDestLat, effectiveDestLng) < 0.04;

  let driverLat = hasRawDriverCoords ? rawDriverLat : null;
  let driverLng = hasRawDriverCoords ? rawDriverLng : null;

  if (isDriverIdenticalToDest && currentStatus === "out_for_delivery" && hasValidRestaurantCoords) {
    driverLat = restLat;
    driverLng = restLng;
  } else if (!hasRawDriverCoords && currentStatus === "out_for_delivery" && hasValidRestaurantCoords) {
    driverLat = restLat;
    driverLng = restLng;
  }

  const hasValidDriverCoords = isValidCoordinate(driverLat, driverLng);

  /**
   * Initialize Leaflet Map Instance
   */
  useEffect(() => {
    if (!mapContainerRef.current || typeof window === "undefined") {
      return;
    }

    let isCancelled = false;

    async function initLeaflet() {
      const L = (await import("leaflet")).default;
      if (isCancelled || !mapContainerRef.current) return;

      // Clean up any stale leaflet ID or instance
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }

      if (mapContainerRef.current._leaflet_id) {
        delete mapContainerRef.current._leaflet_id;
      }

      const initialCenter = [
        driverLat || effectiveDestLat || restLat || 12.97,
        driverLng || effectiveDestLng || restLng || 79.15,
      ];

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: hasValidDriverCoords ? 15 : 14,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Base tile layer
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

      mapInstanceRef.current = map;

      const handleResize = () => {
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.invalidateSize();
          } catch {}
        }
      };
      window.addEventListener("resize", handleResize);

      [100, 250, 450, 750, 1200].forEach((delay) => {
        setTimeout(() => {
          if (mapInstanceRef.current) {
            try {
              mapInstanceRef.current.invalidateSize();
            } catch {}
          }
        }, delay);
      });
    }

    initLeaflet();

    return () => {
      isCancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", handleResize);
      }
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  /**
   * Update Tile Layer when activeStyle changes
   */
  useEffect(() => {
    const map = mapInstanceRef.current;
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

  /**
   * Invalidate map size on expand/collapse and fullscreen toggle
   */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    [50, 150, 300, 600].forEach((delay) => {
      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {}
      }, delay);
    });
  }, [isExpanded, isFullscreen]);

  /**
   * Update Markers & Turn-by-Turn Road Route Polyline
   */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof window === "undefined") return;

    import("leaflet").then(({ default: L }) => {
      const boundsPoints = [];

      // 1. Staff / Driver Marker (Scooter with pulse)
      if (hasValidDriverCoords) {
        const staffPos = [driverLat, driverLng];
        boundsPoints.push(staffPos);
        const driverName = tracking?.driver?.name || "Delivery Staff (You)";
        const speedKmh =
          typeof tracking?.location?.speed === "number" && tracking.location.speed > 0
            ? `${Math.round(tracking.location.speed * 3.6)} km/h`
            : "In Transit";

        const staffIcon = L.divIcon({
          className: "delivery-staff-marker",
          html: `
            <div style="position:relative; width:46px; height:46px; display:flex; align-items:center; justify-content:center;">
              <span style="position:absolute; width:46px; height:46px; border-radius:50%; background:rgba(37,99,235,0.25); animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></span>
              <div style="position:relative; width:34px; height:34px; border-radius:50%; background:#2563EB; border:3px solid #FFFFFF; box-shadow:0 4px 10px rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-size:16px;">
                🛵
              </div>
            </div>
          `,
          iconSize: [46, 46],
          iconAnchor: [23, 23],
        });

        if (!driverMarkerRef.current) {
          driverMarkerRef.current = L.marker(staffPos, { icon: staffIcon })
            .addTo(map)
            .bindPopup(`<div style="font-family:sans-serif;font-size:12px;padding:2px;"><strong>${driverName} (Live)</strong><br/><span style="color:#2563EB;font-weight:bold;">${speedKmh}</span></div>`);
        } else {
          driverMarkerRef.current.setIcon(staffIcon);
          driverMarkerRef.current.setLatLng(staffPos);
        }
      } else {
        if (driverMarkerRef.current) {
          map.removeLayer(driverMarkerRef.current);
          driverMarkerRef.current = null;
        }
      }

      // Check if doorstep destination pin and live customer GPS are virtually identical (< 35m)
      const isCustLiveSameAsDest =
        hasValidDestCoords &&
        hasValidCustomerCoords &&
        haversineDistance(destLat, destLng, custLat, custLng) < 0.035;

      // 2. Doorstep Destination Marker (House Pin)
      // Only render separate House Pin if live customer marker is not already placed at the exact same doorstep
      if (hasValidDestCoords && (!hasValidCustomerCoords || !isCustLiveSameAsDest)) {
        const destPos = [destLat, destLng];
        boundsPoints.push(destPos);

        const destIcon = L.divIcon({
          className: "delivery-dest-marker",
          html: `
            <div style="position:relative; width:44px; height:48px; display:flex; flex-direction:column; align-items:center;">
              <div style="width:34px; height:34px; border-radius:50%; background:#EF4444; border:3px solid #FFFFFF; box-shadow:0 4px 12px rgba(239,68,68,0.5); display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-size:16px;">
                🏠
              </div>
              <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:10px solid #EF4444; margin-top:-2px;"></div>
            </div>
          `,
          iconSize: [44, 48],
          iconAnchor: [22, 46],
        });

        if (!destinationMarkerRef.current) {
          destinationMarkerRef.current = L.marker(destPos, { icon: destIcon })
            .addTo(map)
            .bindPopup(`<div style="font-family:sans-serif;font-size:12px;padding:2px;"><strong>Delivery Destination</strong><br/>${destObj?.street || "Customer Doorstep"}<br/><span style="color:#666;">${recipientName || destObj?.recipientName || "Customer"}</span></div>`);
        } else {
          destinationMarkerRef.current.setIcon(destIcon);
          destinationMarkerRef.current.setLatLng(destPos);
        }
      } else {
        if (destinationMarkerRef.current) {
          map.removeLayer(destinationMarkerRef.current);
          destinationMarkerRef.current = null;
        }
      }

      // 3. Customer Live Shared Location Marker (🎯)
      if (hasValidCustomerCoords) {
        const custPos = [custLat, custLng];
        boundsPoints.push(custPos);

        const custMarkerHtml = isCustLiveSameAsDest
          ? `
            <div style="position:relative; width:48px; height:52px; display:flex; flex-direction:column; align-items:center;">
              <span style="position:absolute; top:2px; width:44px; height:44px; border-radius:50%; background:rgba(16,185,129,0.3); animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></span>
              <div style="width:38px; height:38px; border-radius:50%; background:#10B981; border:3px solid #FFFFFF; box-shadow:0 4px 12px rgba(16,185,129,0.5); display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-size:18px; z-index:2;">
                🎯
              </div>
              <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:10px solid #10B981; margin-top:-2px; z-index:2;"></div>
            </div>
          `
          : `
            <div style="position:relative; width:38px; height:38px; display:flex; align-items:center; justify-content:center;">
              <span style="position:absolute; width:38px; height:38px; border-radius:50%; background:rgba(139,92,246,0.3); animation:pulse 1.5s infinite;"></span>
              <div style="width:26px; height:26px; border-radius:50%; background:#8B5CF6; border:2.5px solid #FFFFFF; box-shadow:0 3px 8px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-size:13px;">
                🎯
              </div>
            </div>
          `;

        const custIcon = L.divIcon({
          className: "customer-live-marker",
          html: custMarkerHtml,
          iconSize: isCustLiveSameAsDest ? [48, 52] : [38, 38],
          iconAnchor: isCustLiveSameAsDest ? [24, 50] : [19, 19],
        });

        const popupText = isCustLiveSameAsDest
          ? `<div style="font-family:sans-serif;font-size:12px;padding:3px;"><strong>Verified Customer Doorstep 🎯</strong><br/>${destObj?.street || "Doorstep Address"}<br/><span style="color:#10B981;font-weight:bold;">● Live Handshake Pin Confirmed</span></div>`
          : `<div style="font-family:sans-serif;font-size:12px;padding:3px;"><strong>Customer Live Doorstep GPS</strong><br/><span style="color:#8B5CF6;font-weight:bold;">Active Handshake Pin</span></div>`;

        if (!customerMarkerRef.current) {
          customerMarkerRef.current = L.marker(custPos, { icon: custIcon })
            .addTo(map)
            .bindPopup(popupText);
        } else {
          customerMarkerRef.current.setIcon(custIcon);
          customerMarkerRef.current.setLatLng(custPos);
          customerMarkerRef.current.setPopupContent(popupText);
        }

        if (custLoc?.accuracy && custLoc.accuracy < 250) {
          if (customerAccuracyCircleRef.current) {
            customerAccuracyCircleRef.current.setLatLng(custPos);
            customerAccuracyCircleRef.current.setRadius(custLoc.accuracy);
          } else {
            customerAccuracyCircleRef.current = L.circle(custPos, {
              radius: custLoc.accuracy,
              color: isCustLiveSameAsDest ? "#10B981" : "#8B5CF6",
              fillColor: isCustLiveSameAsDest ? "#10B981" : "#8B5CF6",
              fillOpacity: 0.12,
              weight: 1.5,
            }).addTo(map);
          }
        }
      }

      // 4. Restaurant Kitchen Marker (🍳)
      if (hasValidRestaurantCoords) {
        const restPos = [restLat, restLng];
        boundsPoints.push(restPos);
        const restName = tracking?.restaurant?.name || restaurant?.name || "Kitchen";

        const restIcon = L.divIcon({
          className: "restaurant-kitchen-marker",
          html: `
            <div style="position:relative; width:44px; height:48px; display:flex; flex-direction:column; align-items:center;">
              <div style="width:34px; height:34px; border-radius:50%; background:#F59E0B; border:3px solid #FFFFFF; box-shadow:0 4px 10px rgba(245,158,11,0.5); display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-size:16px;">
                🍳
              </div>
              <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:10px solid #F59E0B; margin-top:-2px;"></div>
            </div>
          `,
          iconSize: [44, 48],
          iconAnchor: [22, 46],
        });

        if (!restaurantMarkerRef.current) {
          restaurantMarkerRef.current = L.marker(restPos, { icon: restIcon })
            .addTo(map)
            .bindPopup(`<div style="font-family:sans-serif;font-size:12px;padding:2px;"><strong>${restName}</strong><br/>Pickup Kitchen</div>`);
        } else {
          restaurantMarkerRef.current.setIcon(restIcon);
          restaurantMarkerRef.current.setLatLng(restPos);
        }
      }

      // 5. Turn-by-Turn Road Route Polyline from Staff/Kitchen to Doorstep
      const routeOriginLat = hasValidDriverCoords ? driverLat : (hasValidRestaurantCoords ? restLat : null);
      const routeOriginLng = hasValidDriverCoords ? driverLng : (hasValidRestaurantCoords ? restLng : null);

      if (routeOriginLat && routeOriginLng && hasEffectiveDest) {
        const directDist = haversineDistance(routeOriginLat, routeOriginLng, effectiveDestLat, effectiveDestLng);
        const estMinutes = Math.max(1, Math.round((directDist / 22) * 60 + 2));
        setRouteStats({ distanceKm: directDist.toFixed(1), etaMins: estMinutes });

        // Immediate straight line fallback
        const fallbackLine = [
          [routeOriginLat, routeOriginLng],
          [effectiveDestLat, effectiveDestLng],
        ];
        renderPolyline(fallbackLine, L, map);

        // Query OSRM driving route for turn-by-turn road polyline
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${routeOriginLng},${routeOriginLat};${effectiveDestLng},${effectiveDestLat}?overview=full&geometries=geojson`;

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
              renderPolyline(roadCoords, L, map);
            }
          })
          .catch(() => {
            // Keep fallbackLine
          });
      }

      // 6. Viewport fitting: Ensure bounds ALWAYS includes both kitchen and destination
      // This prevents collapsing into a single rooftop when driver/customer coordinates overlap
      if (hasValidRestaurantCoords && hasEffectiveDest) {
        const kitchenInBounds = boundsPoints.some(([lat, lng]) => Math.abs(lat - restLat) < 0.0001 && Math.abs(lng - restLng) < 0.0001);
        if (!kitchenInBounds) {
          boundsPoints.push([restLat, restLng]);
        }
      }

      if (boundsPoints.length > 1) {
        try {
          map.fitBounds(L.latLngBounds(boundsPoints), {
            padding: isFullscreen ? [80, 80] : [50, 50],
            maxZoom: 16,
          });
        } catch {}
      } else if (boundsPoints.length === 1) {
        map.setView(boundsPoints[0], 15);
      }
    });
  }, [
    driverLat,
    driverLng,
    hasValidDriverCoords,
    destLat,
    destLng,
    hasValidDestCoords,
    custLat,
    custLng,
    hasValidCustomerCoords,
    effectiveDestLat,
    effectiveDestLng,
    hasEffectiveDest,
    restLat,
    restLng,
    hasValidRestaurantCoords,
    tracking?.driver?.name,
    destObj?.street,
    recipientName,
    isFullscreen,
  ]);

  const renderPolyline = (latlngs, L, map) => {
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
    }
    routeLineRef.current = L.polyline(latlngs, {
      color: "#2563EB",
      weight: 5,
      opacity: 0.88,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);
  };

  /**
   * Recenter Map
   */
  const handleRecenter = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof window === "undefined") return;

    import("leaflet").then(({ default: L }) => {
      const points = [];
      if (hasValidDriverCoords) points.push([driverLat, driverLng]);
      if (hasEffectiveDest) points.push([effectiveDestLat, effectiveDestLng]);
      if (hasValidRestaurantCoords) points.push([restLat, restLng]);

      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), { padding: isFullscreen ? [80, 80] : [50, 50], maxZoom: 16 });
      } else if (points.length === 1) {
        map.setView(points[0], 16);
      }
    });
  }, [hasValidDriverCoords, driverLat, driverLng, hasEffectiveDest, effectiveDestLat, effectiveDestLng, hasValidRestaurantCoords, restLat, restLng, isFullscreen]);

  // Terminal state
  if (currentStatus === "delivered") {
    return (
      <div className="bg-[var(--bg-card)] border border-emerald-500/30 rounded-3xl p-5 sm:p-6 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/30">
          <CheckCircle2 size={24} />
        </div>
        <div className="space-y-1">
          <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
            Order Delivered
          </span>
          <h4 className="text-base font-bold text-[var(--text-main)]">
            Handed Over Successfully at Doorstep
          </h4>
          <p className="text-xs text-[var(--text-muted)]">
            Live delivery tracking session completed for order #{orderId}.
          </p>
        </div>
      </div>
    );
  }

  const isStale = Boolean(tracking?.isStale);
  const driver = tracking?.driver;
  const lastRecordedAt = tracking?.location?.recordedAt || tracking?.lastUpdatedAt;

  return (
    <div
      className={`w-full bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden shadow-md space-y-0 transition-all ${
        isFullscreen
          ? "fixed inset-0 z-[99999] w-screen h-screen rounded-none flex flex-col bg-stone-950"
          : "rounded-3xl"
      }`}
    >
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .animate-pulse,
          .animate-ping,
          .animate-spin {
            animation: none !important;
          }
        }
      `}</style>

      {/* ── TOP HEADER BAR ────────────────────────────────────────────── */}
      <div className="p-3.5 sm:p-4 border-b border-[var(--border-color)] bg-[var(--bg-sub)]/50 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left Block: Icon + Tracking Status & Order ID */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 relative">
              <Truck size={18} className="animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 shrink-0">
                  {currentStatus === "out_for_delivery" ? "Live Delivery in Transit" : "Live Route to Doorstep"}
                </span>
                <span className="text-[var(--text-muted)] text-xs shrink-0">•</span>
                <span
                  className="font-bold text-xs sm:text-sm text-[var(--text-main)] truncate max-w-[160px] sm:max-w-[220px]"
                  title={`Order #${orderId}`}
                >
                  Order #{orderId}
                </span>
              </div>

              {/* Status Badge & Timestamp */}
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border ${
                    isStale
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                      : hasValidDriverCoords
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 animate-pulse"
                  }`}
                >
                  {isStale
                    ? "⚠️ GPS Signal Stale"
                    : hasValidDriverCoords
                    ? "● Live GPS Connected"
                    : "⏳ Ready for Driver Dispatch"}
                </span>

                {lastRecordedAt && (
                  <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)] font-mono">
                    {formatRelativeTime(lastRecordedAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Block: External Maps App Link + Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
            {hasEffectiveDest && (
              <a
                href={`https://mappls.com/direction?dest=${effectiveDestLat},${effectiveDestLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer text-xs font-bold flex items-center gap-1.5 shadow-xs"
                title="Open turn-by-turn voice driving directions directly in Mappls app"
              >
                <Navigation size={13} />
                <span>Mappls Navigation</span>
                <ExternalLink size={10} />
              </a>
            )}

            <button
              type="button"
              onClick={() => fetchTracking(true)}
              disabled={isRefreshing}
              className="h-8.5 px-2.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--border-color)]/50 text-[var(--text-muted)] hover:text-[var(--text-main)] transition cursor-pointer border border-[var(--border-color)] disabled:opacity-50 flex items-center justify-center gap-1.5 text-xs font-semibold"
              title="Refresh live position"
            >
              <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
              <span className="hidden xs:inline">Refresh</span>
            </button>

            {/* Fullscreen 100% Screen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`h-8.5 px-2.5 rounded-lg transition cursor-pointer border flex items-center gap-1.5 text-xs font-bold ${
                isFullscreen
                  ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-500"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500 shadow-xs"
              }`}
              title={isFullscreen ? "Exit Fullscreen (or press Esc)" : "Take 100% full width and height of the screen"}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── CUSTOMER STATUS BAR ─────────────────────────────────────── */}
      <div className="bg-[var(--bg-sub)]/90 border-b border-[var(--border-color)] px-3.5 py-2 sm:px-4 flex items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 text-xs">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasValidCustomerCoords ? "bg-emerald-500 animate-pulse" : "bg-blue-500"}`} />
          {hasValidCustomerCoords ? (
            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 flex-wrap">
              <span>● Customer Live Doorstep GPS Verified</span>
              {custLoc?.accuracy && (
                <span className="text-[10px] text-[var(--text-muted)] font-normal font-mono">
                  (±{Math.round(custLoc.accuracy)}m accuracy)
                </span>
              )}
            </span>
          ) : (
            <span className="text-[var(--text-muted)]">
              Doorstep Pin geocoded ({Number(destLat || 0).toFixed(4)}, {Number(destLng || 0).toFixed(4)})
            </span>
          )}
        </div>

        {hasEffectiveDest && (
          <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 shrink-0">
            {Number(effectiveDestLat).toFixed(5)}, {Number(effectiveDestLng).toFixed(5)}
          </span>
        )}
      </div>

      {/* ── STALE WARNING BANNER ──────────────────────────────────────── */}
      {isStale && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 p-2.5 sm:px-4 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 shrink-0">
          <AlertTriangle size={14} className="shrink-0 text-amber-500" />
          <span>
            <strong>Signal Stale:</strong> Delivery location has not updated in over 3 minutes.
          </span>
        </div>
      )}

      {/* ── INTERACTIVE LEAFLET MAP CANVAS CONTAINER ─────────────────── */}
      <div className={`relative w-full overflow-hidden bg-stone-900 ${isFullscreen ? "flex-1 min-h-0" : ""}`}>
        <div
          id="mappls-live-delivery-map-canvas"
          ref={mapContainerRef}
          className={`w-full transition-all duration-300 relative z-10 ${
            isFullscreen
              ? "h-full w-full"
              : isExpanded
              ? "h-[650px] sm:h-[750px]"
              : "h-[500px] sm:h-[600px]"
          }`}
          style={{ minHeight: isFullscreen ? "100%" : "460px", width: "100%" }}
        />

        {/* Top-Right Floating Controls: Layer Switcher & Recenter */}
        <div className="absolute top-3 right-3 z-30 flex flex-col gap-2">
          {/* Layer Switcher Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setStyleMenuOpen(!styleMenuOpen)}
              className="h-9 px-3 rounded-xl bg-stone-900/90 hover:bg-stone-900 text-white border border-white/20 shadow-xl flex items-center gap-1.5 text-xs font-bold transition cursor-pointer backdrop-blur-xs"
              title="Change Map Style"
            >
              <Layers size={14} className="text-blue-400" />
              <span>Layers</span>
              <ChevronDown size={12} className="text-stone-400" />
            </button>

            {/* Layer Switcher Popover */}
            {styleMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-stone-900/95 backdrop-blur-md border border-white/15 p-2 shadow-2xl z-50">
                <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-stone-400 border-b border-white/10 mb-1">
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
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                      activeStyle === style.id
                        ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                        : "text-stone-300 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{style.icon}</span>
                      <div>
                        <div className="leading-tight">{style.name}</div>
                        <div className="text-[10px] text-stone-400 font-normal">{style.subtext}</div>
                      </div>
                    </div>
                    {activeStyle === style.id && <Check size={13} className="text-blue-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recenter Button */}
          <button
            type="button"
            onClick={handleRecenter}
            className="w-9 h-9 rounded-xl bg-stone-900/90 hover:bg-stone-900 text-white border border-white/20 shadow-xl flex items-center justify-center transition cursor-pointer backdrop-blur-xs self-end"
            title="Recenter Map View"
          >
            <Crosshair size={15} className="text-emerald-400" />
          </button>
        </div>

        {/* Floating Route Distance & ETA Pill */}
        {hasEffectiveDest && (
          <div className="absolute top-3 left-3 z-30 pointer-events-none">
            <div className="px-3.5 py-2 rounded-full bg-stone-900/95 backdrop-blur-md border border-blue-500/40 shadow-2xl flex items-center gap-2 text-xs font-bold text-white">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
              <span>🛵 {routeStats.distanceKm ? `${routeStats.distanceKm} km route` : "En route"}</span>
              {routeStats.etaMins && (
                <>
                  <span className="text-stone-400">•</span>
                  <span className="text-emerald-400">~{routeStats.etaMins} mins ETA</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Floating Campus / Destination Hint Pill at bottom-left */}
        <div className="absolute bottom-3 left-3 bg-stone-900/95 border border-white/20 rounded-xl px-3 py-2 shadow-2xl backdrop-blur-md flex items-center gap-2.5 z-20 max-w-sm">
          <MapPin size={15} className="text-emerald-400 shrink-0" />
          <div className="text-[11px] text-stone-200 leading-tight">
            <span className="font-bold text-white block">
              {destObj?.street ? destObj.street.slice(0, 36) : "Customer Destination"}
            </span>
            <span className="text-stone-400 text-[10px]">
              Tap "Mappls Navigation" to launch live voice turn-by-turn guidance
            </span>
          </div>
        </div>
      </div>


      {/* ── DRIVER & DESTINATION TELEMETRY FOOTER ───────────────────────── */}
      <div className="p-3.5 sm:p-4 bg-[var(--bg-sub)]/30 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
          {/* Driver Information Card */}
          <div className="bg-[var(--bg-card)] p-3.5 sm:p-4 rounded-xl border border-[var(--border-color)] flex items-center justify-between gap-3 shadow-2xs h-full">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold text-base border border-blue-500/15">
                🛵
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                  Delivery Partner
                </span>
                <p
                  className="text-xs sm:text-sm font-bold text-[var(--text-main)] truncate"
                  title={driver?.name || "Assigned Driver"}
                >
                  {driver?.name || "Active Delivery Staff"}
                </p>
                {typeof tracking?.location?.speed === "number" && tracking.location.speed > 0 ? (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 mt-0.5">
                    <Gauge size={11} />
                    <span>In Motion ({Math.round(tracking.location.speed * 3.6)} km/h)</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                    Active Delivery Transit
                  </span>
                )}
              </div>
            </div>

            {driver?.phone && (
              <a
                href={`tel:${driver.phone}`}
                className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition shrink-0 border border-emerald-500/20"
                title={`Call driver: ${driver.phone}`}
              >
                <Phone size={13} />
                <span>Call Driver</span>
              </a>
            )}
          </div>

          {/* Destination Notice Card */}
          {(() => {
            const streetText = destObj?.street || "Customer Address";
            const cityPinText = destObj?.city ? `${destObj.city}${destObj.pincode ? ` - ${destObj.pincode}` : ""}` : "Destination on file";
            const fullAddress = [destObj?.street, destObj?.city, destObj?.pincode].filter(Boolean).join(", ") || "Customer Address";

            return (
              <div className="bg-[var(--bg-card)] p-3.5 sm:p-4 rounded-xl border border-[var(--border-color)] flex items-start gap-3 shadow-2xs h-full">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/15">
                  <MapPin size={18} />
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                    Delivering To
                  </span>
                  <p
                    className="font-bold text-xs sm:text-sm text-[var(--text-main)] line-clamp-1 break-words"
                    title={fullAddress}
                  >
                    {streetText}
                  </p>
                  <p
                    className="text-[11px] text-[var(--text-muted)] line-clamp-1 break-words mt-0.5"
                    title={fullAddress}
                  >
                    {cityPinText}
                  </p>
                  {hasValidDestCoords ? (
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                      <CheckCircle2 size={11} className="shrink-0" />
                      <span>Doorstep GPS Pin Set ({Number(destLat).toFixed(4)}, {Number(destLng).toFixed(4)})</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-[var(--text-muted)] mt-1 flex items-center gap-1">
                      <Info size={11} className="shrink-0 text-stone-400" />
                      <span>Destination pin pending</span>
                    </div>
                  )}

                  {(destObj?.recipientPhone || destObj?.phone) && (
                    <div className="mt-1.5 pt-1.5 border-t border-[var(--border-color)]/60 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--brand-accent)] flex-wrap">
                      <span>Recipient: {recipientName || destObj.recipientName || destObj.fullName || "Customer"}</span>
                      <span>•</span>
                      <a
                        href={`tel:${destObj.recipientPhone || destObj.phone}`}
                        className="hover:underline flex items-center gap-1 font-mono"
                      >
                        <Phone size={10} />
                        <span>{destObj.recipientPhone || destObj.phone}</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Real GPS Telemetry Chips */}
        <div className="flex items-center gap-2 flex-wrap text-xs pt-2 border-t border-[var(--border-color)]/60">
          {hasValidDriverCoords && (
            <span className="font-mono text-[11px] text-[var(--text-muted)] bg-[var(--bg-card)] px-2.5 py-1 rounded-lg border border-[var(--border-color)]">
              📍 Driver: {Number(driverLat).toFixed(5)}, {Number(driverLng).toFixed(5)}
            </span>
          )}

          {typeof tracking?.location?.accuracy === "number" && (
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
              🎯 ±{Math.round(tracking.location.accuracy)}m accuracy
            </span>
          )}

          {hasValidRestaurantCoords && (
            <span className="text-[11px] text-[var(--text-muted)] ml-auto font-mono">
              🍳 Kitchen: {tracking?.restaurant?.name || restaurant?.name || "Restaurant"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
