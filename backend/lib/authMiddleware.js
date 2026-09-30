import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Restaurant from "@/models/Restaurant";

export async function getAuthSession() {
  return await getServerSession(authOptions);
}

export async function requireSuperAdmin() {
  const session = await getAuthSession();
  if (!session || !session.user) {
    return { error: "Authentication required", status: 401 };
  }

  await connectDB();
  const dbUser = await User.findOne({ email: session.user.email });
  if (!dbUser) {
    return { error: "User not found", status: 404 };
  }

  if (dbUser.status === "suspended") {
    return { error: "Account is suspended. Contact administrator.", status: 403 };
  }

  if (dbUser.role !== "superadmin") {
    return { error: "Access denied. Superadmin privileges required.", status: 403 };
  }

  const configuredSuperadminEmails = (process.env.SUPERADMIN_EMAIL || "")
    .toLowerCase()
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const userEmail = dbUser.email?.toLowerCase().trim();
  const isAllowedSuperadmin =
    configuredSuperadminEmails.length === 0 ||
    configuredSuperadminEmails.includes(userEmail) ||
    userEmail === "superadmin.petprotocols@gmail.com" ||
    userEmail === "superadmin@petprotocols.com";

  if (!isAllowedSuperadmin) {
    return { error: "Access denied. Only the dedicated Superadmin email is authorized.", status: 403 };
  }

  return { user: dbUser };
}

export async function requireRestaurantAdmin({ allowStaff = false, requiredPermission = null } = {}) {
  const session = await getAuthSession();
  if (!session || !session.user) {
    return { error: "Authentication required", status: 401 };
  }

  await connectDB();
  const dbUser = await User.findOne({ email: session.user.email }).populate("restaurant");
  if (!dbUser) {
    return { error: "User not found", status: 404 };
  }

  if (dbUser.status === "suspended" || dbUser.status === "inactive") {
    return { error: "Account is inactive or suspended. Contact administrator.", status: 403 };
  }

  const isStaff = dbUser.role === "staff";
  const isAdmin = dbUser.role === "restaurant_admin" || dbUser.role === "admin" || dbUser.role === "superadmin";

  if (!isAdmin && (!allowStaff || !isStaff)) {
    return { error: "Access denied. Restaurant Admin privileges required.", status: 403 };
  }

  if (isStaff && requiredPermission) {
    const userPermissions = Array.isArray(dbUser.permissions) ? dbUser.permissions : [];
    if (!userPermissions.includes(requiredPermission) && !userPermissions.includes("all")) {
      return { error: `Access denied. Requires '${requiredPermission}' permission.`, status: 403 };
    }
  }

  if (dbUser.role === "superadmin") {
    const configuredSuperadminEmail = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
    if (configuredSuperadminEmail && dbUser.email?.toLowerCase().trim() !== configuredSuperadminEmail) {
      return { error: "Access denied. Superadmin email mismatch.", status: 403 };
    }
  }

  let restaurant = dbUser.restaurant;
  if (!restaurant && dbUser.role === "superadmin") {
    restaurant = await Restaurant.findOne({ status: "active" });
  }

  if (!restaurant) {
    return { error: "No restaurant associated with this account.", status: 400 };
  }

  if (requiredFeature && Array.isArray(restaurant.enabledFeatures)) {
    if (!restaurant.enabledFeatures.includes(requiredFeature)) {
      return {
        error: `Feature module '${requiredFeature}' is disabled for this restaurant by Super Admin.`,
        status: 403,
      };
    }
  }

  return {
    user: dbUser,
    restaurant,
    restaurantId: restaurant._id.toString(),
    isStaff,
    isAdmin,
    staffRoles: dbUser.staffRoles?.length ? dbUser.staffRoles : [dbUser.staffRole || "Staff"],
    permissions: dbUser.permissions || [],
  };
}

export async function requireRestaurantStaff(requiredPermission = null) {
  return await requireRestaurantAdmin({ allowStaff: true, requiredPermission });
}
