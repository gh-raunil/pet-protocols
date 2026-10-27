import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Restaurant from "@/models/Restaurant";
import Product from "@/models/Product";
import { isValidCoordinate, validateDeliveryServiceability } from "@/lib/geoDistance";

// GET — List active restaurants for public browsing (supports optional location-based serviceability)
export async function GET(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const latParam = searchParams.get("lat") ?? searchParams.get("latitude");
    const lngParam = searchParams.get("lng") ?? searchParams.get("longitude");
    const orderType = searchParams.get("orderType") || "delivery";

    let filter = { status: "active" };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { cuisineType: { $in: [new RegExp(search, "i")] } },
      ];
    }

    const restaurants = await Restaurant.find(filter).sort({ rating: -1, createdAt: -1 }).lean();

    // Determine if coordinates were provided
    const hasLat = latParam !== null;
    const hasLng = lngParam !== null;

    let customerCoords = null;

    if (hasLat || hasLng) {
      // Exactly one coordinate dimension supplied
      if (!hasLat || !hasLng) {
        return NextResponse.json(
          {
            success: false,
            error: "Both latitude and longitude must be provided together.",
            code: "INVALID_COORDINATES",
          },
          { status: 400 }
        );
      }

      // Both provided, check for empty values
      if (
        (typeof latParam === "string" && latParam.trim() === "") ||
        (typeof lngParam === "string" && lngParam.trim() === "")
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Latitude and longitude cannot be empty.",
            code: "INVALID_COORDINATES",
          },
          { status: 400 }
        );
      }

      // Check numeric validity
      const nLat = Number(latParam);
      const nLng = Number(lngParam);
      if (isNaN(nLat) || isNaN(nLng) || !isFinite(nLat) || !isFinite(nLng)) {
        return NextResponse.json(
          {
            success: false,
            error: "Latitude and longitude must be valid numeric values.",
            code: "INVALID_COORDINATES",
          },
          { status: 400 }
        );
      }

      // Check Null Island (0, 0)
      if (nLat === 0 && nLng === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Coordinates (0, 0) represent Null Island and cannot be used as a delivery destination.",
            code: "INVALID_COORDINATES",
          },
          { status: 400 }
        );
      }

      // Check geographic boundaries
      if (nLat < -90 || nLat > 90 || nLng < -180 || nLng > 180) {
        return NextResponse.json(
          {
            success: false,
            error: "Coordinates are outside geographic limits (-90 to 90 latitude, -180 to 180 longitude).",
            code: "INVALID_COORDINATES",
          },
          { status: 400 }
        );
      }

      customerCoords = {
        latitude: nLat,
        longitude: nLng,
      };
    }

    // Attach product count and authoritative live serviceability
    let serviceableCount = 0;

    const enriched = await Promise.all(
      restaurants.map(async (r) => {
        const productCount = await Product.countDocuments({ restaurant: r._id, isAvailable: true });

        let serviceability = null;
        if (customerCoords) {
          serviceability = validateDeliveryServiceability({
            restaurant: r,
            orderType,
            address: customerCoords,
          });
          if (serviceability.isServiceable) {
            serviceableCount++;
          }
        }

        return {
          ...r,
          productCount,
          serviceability,
          distanceKm: serviceability?.distanceKm ?? null,
        };
      })
    );

    const responsePayload = {
      success: true,
      restaurants: enriched,
    };

    if (customerCoords) {
      responsePayload.customerCoordinates = customerCoords;
      responsePayload.serviceableCount = serviceableCount;
      responsePayload.isAnyRestaurantServiceable = serviceableCount > 0;
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
