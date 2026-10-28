"use client";

import React from "react";
import LiveDeliveryMap from "../orders/LiveDeliveryMap";

/**
 * DeliveryRouteMap
 * Adapter that proxies to LiveDeliveryMap so the staff UI renders
 * the exact same interactive road route, scooter marker, ETA pill,
 * and map tile switcher as the customer UI.
 */
export default function DeliveryRouteMap({
  origin = null,
  destination = null,
  customerLocation = null,
  restaurant = null,
  deliveryTracking = null,
  orderId = "",
  recipientName = "",
  initialStatus = "out_for_delivery",
  isManagerView = false,
  compact = true,
  isEnlarged = false,
  onToggleEnlarge = null,
}) {
  return (
    <div className={isEnlarged ? "" : "w-full h-full min-h-[220px]"}>
      <LiveDeliveryMap
        orderId={orderId}
        initialStatus={initialStatus}
        restaurant={restaurant}
        destination={destination}
        customerLocation={customerLocation}
        deliveryTracking={deliveryTracking}
        origin={origin}
        recipientName={recipientName}
        isStaffView={!isManagerView}
        isManagerView={isManagerView}
        compact={compact}
        isEnlarged={isEnlarged}
        onFullscreenChange={onToggleEnlarge}
      />
    </div>
  );
}
