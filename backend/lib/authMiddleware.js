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

  const configuredSuperadminEmail = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
  if (configuredSuperadminEmail && dbUser.email?.toLowerCase().trim() !== configuredSuperadminEmail) {
    return { error: "Access denied. Only the dedicated Superadmin email is authorized.", status: 403 };
  }

  return { user: dbUser };
}

export async function requireRestaurantAdmin() {
  const session = await getAuthSession();
  if (!session || !session.user) {
    return { error: "Authentication required", status: 401 };
  }

  await connectDB();
  const dbUser = await User.findOne({ email: session.user.email }).populate("restaurant");
  if (!dbUser) {
    return { error: "User not found", status: 404 };
  }

  if (dbUser.status === "suspended") {
    return { error: "Account is suspended. Contact administrator.", status: 403 };
  }

  if (dbUser.role !== "restaurant_admin" && dbUser.role !== "admin" && dbUser.role !== "superadmin") {
    return { error: "Access denied. Restaurant Admin privileges required.", status: 403 };
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
    return { error: "No restaurant associated with this admin account.", status: 400 };
  }

  return {
    user: dbUser,
    restaurant,
    restaurantId: restaurant._id.toString(),
  };
}
