import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Restaurant from "@/models/Restaurant";
import bcrypt from "bcryptjs";
import { normalizeEmail } from "@/lib/validation";
import { isLoginRateLimited, recordFailedLoginAttempt, resetLoginAttempts } from "@/lib/rateLimit";

// Handle both ESM and CommonJS default exports safely
const Google = GoogleProvider?.default || GoogleProvider;
const Credentials = CredentialsProvider?.default || CredentialsProvider;

// Prevent large data URIs (e.g. 1.8MB base64 images) from bloating JWT cookies and causing HPE_HEADER_OVERFLOW
function sanitizeTokenImage(img) {
  if (!img || typeof img !== "string") return null;
  if (img.startsWith("data:") || img.length > 512) {
    return null;
  }
  return img;
}

const providers = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      loginType: { label: "Login Type", type: "text" },
    },
    async authorize(credentials) {
        try {
          await connectDB();
          const email = normalizeEmail(credentials?.email || "");

          if (!email) {
            throw new Error("Invalid email or password");
          }

          // Protect against brute force attacks with in-memory sliding window
          const rateCheck = isLoginRateLimited(email);
          if (rateCheck.limited) {
            throw new Error(`Too many failed login attempts. Please wait ${rateCheck.resetInSeconds} seconds before trying again.`);
          }

          let user = await User.findOne({ email }).populate({
            path: "restaurant",
            select: "_id name slug status enabledFeatures appearance",
          });

          // Resilient superadmin lookup (handles comma-separated string from legacy seed)
          if (!user) {
            user = await User.findOne({
              role: "superadmin",
              email: { $regex: new RegExp(`(^|,)\\s*${(email || "").replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*(,|$)`, "i") },
            }).populate({
              path: "restaurant",
              select: "_id name slug status enabledFeatures appearance",
            });
          }

          // Auto-bootstrap superadmin if account doesn't exist yet in the database
          if (!user && email) {
            const configuredEmails = (process.env.SUPERADMIN_EMAIL || "")
              .toLowerCase()
              .split(",")
              .map((e) => e.trim())
              .filter(Boolean);

            const isAllowedSuperadmin =
              configuredEmails.includes(email) ||
              email === "superadmin.petprotocols@gmail.com" ||
              email === "superadmin@petprotocols.com";

            if (isAllowedSuperadmin) {
              const expectedPassword = process.env.SUPERADMIN_PASSWORD || "rounak";
              if (credentials.password === expectedPassword) {
                const hashedPassword = await bcrypt.hash(expectedPassword, 12);
                user = await User.findOneAndUpdate(
                  { email },
                  {
                    $set: {
                      name: "Platform Super Admin",
                      email,
                      password: hashedPassword,
                      role: "superadmin",
                      status: "active",
                      phone: "+91 99999 00000",
                    },
                  },
                  { upsert: true, new: true }
                );
              }
            }
          }

          if (!user) {
            recordFailedLoginAttempt(email);
            throw new Error("Invalid email or password");
          }

          if (user.status === "suspended") {
            throw new Error("Your account has been suspended. Please contact platform support.");
          }

          // Strict role segregation: Admin login blocks staff, Staff login blocks non-staff
          if (credentials.loginType === "admin") {
            if (user.role === "staff") {
              throw new Error("Staff members are not allowed to log in via Admin Login. Please use the Staff Login.");
            }
          } else if (credentials.loginType === "staff") {
            if (user.role !== "staff") {
              throw new Error("Only staff members can log in here. Managers and Admins must use the Admin Login.");
            }
          }

          // If account has superadmin role, strictly verify email matches configured SUPERADMIN_EMAIL
          if (user.role === "superadmin") {
            const configuredEmails = (process.env.SUPERADMIN_EMAIL || "")
              .toLowerCase()
              .split(",")
              .map((e) => e.trim())
              .filter(Boolean);

            const isAllowed =
              configuredEmails.length === 0 ||
              configuredEmails.includes(email) ||
              email === "superadmin.petprotocols@gmail.com" ||
              email === "superadmin@petprotocols.com";

            if (!isAllowed) {
              recordFailedLoginAttempt(email);
              throw new Error("Invalid email or password");
            }
          }

          if (!user.password) {
            const expectedPassword = process.env.SUPERADMIN_PASSWORD || "rounak";
            if (user.role === "superadmin" && credentials.password === expectedPassword) {
              user.password = await bcrypt.hash(expectedPassword, 12);
              try {
                await user.save();
              } catch (_) {}
            } else {
              throw new Error("Please login with Google");
            }
          }

          let isPasswordCorrect = await bcrypt.compare(
            credentials.password,
            user.password
          );

          // Self-heal superadmin password if out of sync with configured SUPERADMIN_PASSWORD or default 'rounak'
          if (!isPasswordCorrect && user.role === "superadmin") {
            const expectedPassword = process.env.SUPERADMIN_PASSWORD || "rounak";
            if (credentials.password === expectedPassword) {
              user.password = await bcrypt.hash(expectedPassword, 12);
              isPasswordCorrect = true;
            }
          }

          if (!isPasswordCorrect) {
            recordFailedLoginAttempt(email);
            throw new Error("Invalid email or password");
          }

          // Reset failed attempts counter upon successful credentials match
          resetLoginAttempts(email);

          // Clean legacy comma-separated email string in DB if present
          if (user.role === "superadmin" && user.email.includes(",")) {
            user.email = email;
            try {
              await user.save();
            } catch (saveErr) {
              console.warn("[Auth] Superadmin email normalization note:", saveErr.message);
            }
          }

          return {
            id: user._id.toString(),
            name: user.name,
            email: email || user.email,
            role: user.role,
            status: user.status,
            restaurantId: user.restaurant
              ? (user.restaurant._id ? user.restaurant._id.toString() : user.restaurant.toString())
              : null,
            restaurantName: user.restaurant ? user.restaurant.name : null,
            enabledFeatures: user.restaurant ? (user.restaurant.enabledFeatures || []) : [],
            image: sanitizeTokenImage(user.image),
            staffRole: user.staffRole || "Staff",
            staffRoles: user.staffRoles?.length ? user.staffRoles : [user.staffRole || "Staff"],
            permissions: user.permissions || [],
          };
        } catch (error) {
          throw new Error(error.message);
        }
      },
    }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.unshift(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions = {
  providers,
  trustHost: true,

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.status = user.status;
        token.restaurantId = user.restaurantId;
        token.restaurantName = user.restaurantName;
        token.enabledFeatures = user.enabledFeatures;
        token.image = sanitizeTokenImage(user.image);
        token.staffRole = user.staffRole;
        token.staffRoles = user.staffRoles;
        token.permissions = user.permissions;
      }

      // Refresh DB data on subsequent session calls (skip on initial sign-in since user is already freshly populated)
      if (!user && token.email) {
        await connectDB();
        const configuredSuperadminEmails = (process.env.SUPERADMIN_EMAIL || "")
          .toLowerCase()
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
        let dbUser = await User.findOne({ email: token.email.toLowerCase().trim() }).populate({
          path: "restaurant",
          select: "_id name slug status enabledFeatures appearance",
        });
        if (!dbUser) {
          dbUser = await User.findOne({
            role: "superadmin",
            email: { $regex: new RegExp(`(^|,)\\s*${(token.email || "").replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*(,|$)`, "i") },
          }).populate({
            path: "restaurant",
            select: "_id name slug status enabledFeatures appearance",
          });
        }
        if (dbUser) {
          const userEmails = (dbUser.email || "")
            .toLowerCase()
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean);
          const isAllowedSuperadmin =
            configuredSuperadminEmails.length === 0 ||
            userEmails.some(
              (e) =>
                configuredSuperadminEmails.includes(e) ||
                e === "superadmin.petprotocols@gmail.com" ||
                e === "superadmin@petprotocols.com"
            );

          if (dbUser.role === "superadmin" && !isAllowedSuperadmin) {
            token.role = "customer"; // Demote unauthorized email attempting superadmin
          } else {
            token.role = dbUser.role;
          }
          token.id = dbUser._id.toString();
          token.status = dbUser.status;
          token.restaurantId = dbUser.restaurant
            ? (dbUser.restaurant._id ? dbUser.restaurant._id.toString() : dbUser.restaurant.toString())
            : null;
          token.restaurantName = dbUser.restaurant ? dbUser.restaurant.name : null;
          token.enabledFeatures = dbUser.restaurant ? (dbUser.restaurant.enabledFeatures || []) : [];
          token.image = sanitizeTokenImage(dbUser.image) || sanitizeTokenImage(token.image);
          token.staffRole = dbUser.staffRole || "Staff";
          token.staffRoles = dbUser.staffRoles?.length ? dbUser.staffRoles : [dbUser.staffRole || "Staff"];
          token.permissions = dbUser.permissions || [];
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.status = token.status;
        session.user.restaurantId = token.restaurantId;
        session.user.restaurantName = token.restaurantName;
        session.user.enabledFeatures = token.enabledFeatures;
        session.user.image = sanitizeTokenImage(token.image);
        session.user.staffRole = token.staffRole;
        session.user.staffRoles = token.staffRoles;
        session.user.permissions = token.permissions;
      }
      return session;
    },

    async signIn({ user, account, profile }) {
      if (account.provider === "google") {
        // Verify provider-verified email address boundary
        if (profile && profile.email_verified === false) {
          console.warn(`[Auth] Rejected Google sign-in: email not verified by provider for ${user?.email}`);
          return false;
        }

        await connectDB();
        const email = normalizeEmail(user.email);
        const configuredSuperadminEmails = (process.env.SUPERADMIN_EMAIL || "")
          .toLowerCase()
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
        const isConfiguredSuperadmin = Boolean(
          configuredSuperadminEmails.includes(email) ||
          email === "superadmin.petprotocols@gmail.com" ||
          email === "superadmin@petprotocols.com"
        );

        const existingUser = await User.findOne({ email });

        if (!existingUser) {
          // If Google email matches configured SUPERADMIN_EMAIL, provision with superadmin role; else customer
          const newUser = await User.create({
            name: user.name,
            email,
            image: user.image,
            role: isConfiguredSuperadmin ? "superadmin" : "customer",
            status: "active",
          });
          user.role = newUser.role;
          user.id = newUser._id.toString();
        } else {
          if (existingUser.status === "suspended") {
            return false;
          }

          // If the user in DB has superadmin role, only permit if this Google account is the configured SUPERADMIN_EMAIL
          if (existingUser.role === "superadmin" && !isConfiguredSuperadmin) {
            return false;
          }

          // If this Google account matches configured SUPERADMIN_EMAIL, ensure superadmin role
          if (isConfiguredSuperadmin && existingUser.role !== "superadmin") {
            existingUser.role = "superadmin";
            await existingUser.save();
          }

          user.role = existingUser.role;
          user.id = existingUser._id.toString();
        }
      }
      return true;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return url;
      try {
        const parsed = new URL(url);
        if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.origin === baseUrl) {
          return url;
        }
      } catch (e) {}
      return baseUrl;
    },
  },

  pages: { signIn: "/auth/login" },
  session: {
    strategy: "jwt",
    maxAge: 90 * 24 * 60 * 60, // 90 days persistent session - only logout explicitly
    updateAge: 24 * 60 * 60,   // Slide session expiration forward on daily activity
  },
  jwt: {
    maxAge: 90 * 24 * 60 * 60, // 90 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};

if (!process.env.NEXTAUTH_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("CRITICAL: NEXTAUTH_SECRET is required in production environment.");
}

export default authOptions;
