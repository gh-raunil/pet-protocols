import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Restaurant from "@/models/Restaurant";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

// GET — Fetch restaurant profile & all settings
export async function GET() {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    await connectDB();

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return NextResponse.json({ success: false, message: "Restaurant not found." }, { status: 404 });
    }

    // Never return private secrets; return safe config statuses
    const safeMeta = {
      razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID),
      cloudinaryConfigured: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
    };

    return NextResponse.json({
      success: true,
      restaurant,
      meta: safeMeta,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT — Update restaurant settings
export async function PUT(request) {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const body = await request.json();

    await connectDB();

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return NextResponse.json({ success: false, message: "Restaurant not found." }, { status: 404 });
    }

    // 1. General & Info
    if (body.name !== undefined && body.name.trim()) restaurant.name = body.name.trim();
    if (body.shortDescription !== undefined) restaurant.shortDescription = String(body.shortDescription || '').trim();
    if (body.fullDescription !== undefined) restaurant.fullDescription = String(body.fullDescription || '').trim();
    if (body.description !== undefined) {
      restaurant.description = body.description;
      if (!body.shortDescription) restaurant.shortDescription = body.description;
    }
    if (body.category !== undefined) restaurant.category = String(body.category || '').trim();
    if (body.tags !== undefined) {
      restaurant.tags = Array.isArray(body.tags)
        ? body.tags.map((t) => String(t).trim()).filter(Boolean)
        : String(body.tags).split(',').map((t) => t.trim()).filter(Boolean);
    }
    if (body.cuisineType !== undefined) {
      restaurant.cuisineType = Array.isArray(body.cuisineType)
        ? body.cuisineType.map((c) => String(c).trim()).filter(Boolean)
        : String(body.cuisineType).split(',').map((c) => c.trim()).filter(Boolean);
    }
    if (body.image !== undefined) restaurant.image = body.image;
    if (body.bannerImage !== undefined) restaurant.bannerImage = body.bannerImage;

    // 2. Contact Information
    if (body.phone !== undefined) restaurant.phone = String(body.phone || '').trim();
    if (body.whatsappNumber !== undefined) {
      const cleanWa = String(body.whatsappNumber || '').trim();
      if (cleanWa && !/^[+]?[\d\s\-()]{7,20}$/.test(cleanWa)) {
        return NextResponse.json(
          { success: false, message: "Please provide a valid WhatsApp phone number (7-20 digits) or leave it empty." },
          { status: 400 }
        );
      }
      restaurant.whatsappNumber = cleanWa;
    }
    if (body.email !== undefined) restaurant.email = String(body.email || '').trim();
    if (body.supportEmail !== undefined) restaurant.supportEmail = String(body.supportEmail || '').trim();
    if (body.showPhoneToCustomers !== undefined) restaurant.showPhoneToCustomers = Boolean(body.showPhoneToCustomers);
    if (body.showWhatsappToCustomers !== undefined) restaurant.showWhatsappToCustomers = Boolean(body.showWhatsappToCustomers);

    // 3. Location & Address
    if (body.address && typeof body.address === 'object') {
      restaurant.address = {
        ...restaurant.address?.toObject?.() || restaurant.address || {},
        ...body.address,
      };
    }

    // 4. Regional Settings
    if (body.regionalSettings && typeof body.regionalSettings === 'object') {
      restaurant.regionalSettings = {
        ...restaurant.regionalSettings?.toObject?.() || restaurant.regionalSettings || {},
        ...body.regionalSettings,
      };
    }

    // 5. Business & Availability
    if (body.isOpen !== undefined) restaurant.isOpen = Boolean(body.isOpen);
    if (body.acceptingOrders !== undefined) restaurant.acceptingOrders = Boolean(body.acceptingOrders);
    if (body.isTemporarilyClosed !== undefined) restaurant.isTemporarilyClosed = Boolean(body.isTemporarilyClosed);
    if (body.closureReason !== undefined) restaurant.closureReason = String(body.closureReason || '').trim();
    if (body.openingHours !== undefined) {
      restaurant.openingHours = String(body.openingHours || '').trim();
    }
    if (body.weeklyHours && typeof body.weeklyHours === 'object') {
      restaurant.weeklyHours = {
        ...restaurant.weeklyHours?.toObject?.() || restaurant.weeklyHours || {},
        ...body.weeklyHours,
      };

      // If openingHours was not explicitly provided or is being auto-synced, synthesize from weeklyHours
      if (!body.openingHours) {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const openDay = days.find((d) => restaurant.weeklyHours[d]?.isOpen && restaurant.weeklyHours[d]?.slots?.[0]?.open);
        if (openDay) {
          const slot = restaurant.weeklyHours[openDay].slots[0];
          const fmt12 = (t) => {
            if (!t) return '';
            const [hStr, mStr] = t.split(':');
            let h = parseInt(hStr, 10);
            const m = (mStr || '00').padStart(2, '0');
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12;
            if (h === 0) h = 12;
            return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
          };
          restaurant.openingHours = `${fmt12(slot.open)} - ${fmt12(slot.close)}`;
        }
      }
    }
    if (body.specialHours && Array.isArray(body.specialHours)) {
      restaurant.specialHours = body.specialHours;
    }
    if (body.prepTimeSettings && typeof body.prepTimeSettings === 'object') {
      restaurant.prepTimeSettings = {
        ...restaurant.prepTimeSettings?.toObject?.() || restaurant.prepTimeSettings || {},
        ...body.prepTimeSettings,
      };
    }

    // 6. Ordering Settings
    if (body.orderTypes && typeof body.orderTypes === 'object') {
      restaurant.orderTypes = {
        ...restaurant.orderTypes?.toObject?.() || restaurant.orderTypes || {},
        ...body.orderTypes,
      };
    }
    if (body.orderingSettings && typeof body.orderingSettings === 'object') {
      restaurant.orderingSettings = {
        ...restaurant.orderingSettings?.toObject?.() || restaurant.orderingSettings || {},
        ...body.orderingSettings,
      };
    }
    if (body.orderLimits && typeof body.orderLimits === 'object') {
      restaurant.orderLimits = {
        ...restaurant.orderLimits?.toObject?.() || restaurant.orderLimits || {},
        ...body.orderLimits,
      };
    }
    if (body.cancellationSettings && typeof body.cancellationSettings === 'object') {
      restaurant.cancellationSettings = {
        ...restaurant.cancellationSettings?.toObject?.() || restaurant.cancellationSettings || {},
        ...body.cancellationSettings,
      };
    }

    // 7. Menu Settings
    if (body.menuSettings && typeof body.menuSettings === 'object') {
      restaurant.menuSettings = {
        ...restaurant.menuSettings?.toObject?.() || restaurant.menuSettings || {},
        ...body.menuSettings,
      };
    }

    // 8. Payment & Charges Settings
    if (body.paymentSettings && typeof body.paymentSettings === 'object') {
      restaurant.paymentSettings = {
        ...restaurant.paymentSettings?.toObject?.() || restaurant.paymentSettings || {},
        ...body.paymentSettings,
      };
    }
    if (body.taxSettings && typeof body.taxSettings === 'object') {
      restaurant.taxSettings = {
        ...restaurant.taxSettings?.toObject?.() || restaurant.taxSettings || {},
        ...body.taxSettings,
      };
    }
    if (body.chargeSettings && typeof body.chargeSettings === 'object') {
      restaurant.chargeSettings = {
        ...restaurant.chargeSettings?.toObject?.() || restaurant.chargeSettings || {},
        ...body.chargeSettings,
      };
    }

    // 9. Delivery Settings
    if (body.deliverySettings && typeof body.deliverySettings === 'object') {
      restaurant.deliverySettings = {
        ...restaurant.deliverySettings?.toObject?.() || restaurant.deliverySettings || {},
        ...body.deliverySettings,
      };
    }

    // 10. Notification Settings
    if (body.notificationSettings && typeof body.notificationSettings === 'object') {
      restaurant.notificationSettings = {
        ...restaurant.notificationSettings?.toObject?.() || restaurant.notificationSettings || {},
        ...body.notificationSettings,
      };
    }

    // 11. Appearance
    if (body.appearance && typeof body.appearance === 'object') {
      restaurant.appearance = {
        ...restaurant.appearance?.toObject?.() || restaurant.appearance || {},
        ...body.appearance,
      };
    }

    await restaurant.save();

    return NextResponse.json({
      success: true,
      message: "Settings saved successfully!",
      restaurant,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
