import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Restaurant from "@/models/Restaurant";
import bcrypt from "bcryptjs";
import { normalizeEmail } from "@/lib/validation";
import { isLoginRateLimited, recordFailedLoginAttempt, resetLoginAttempts, getClientIp } from "@/lib/rateLimit";

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

export function getConfiguredSuperadminEmails() {
  return (process.env.SUPERADMIN_EMAIL || "")
    .toLowerCase()
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

export function getAllowedRedirectOrigins(baseUrl) {
  const isProduction = process.env.NODE_ENV === "production";
  const origins = new Set();

  if (baseUrl) {
    try {
      origins.add(new URL(baseUrl).origin);
    } catch (_) {}
  }

  const envOrigins = [
    process.env.NEXTAUTH_URL,
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
    process.env.SUPERADMIN_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];

  for (const raw of envOrigins) {
    if (raw && typeof raw === "string") {
      try {
        origins.add(new URL(raw.trim()).origin);
      } catch (_) {}
    }
  }

  // Allow localhost and 127.0.0.1 loopbacks ONLY in non-production environments
  if (!isProduction) {
    origins.add("http://localhost:3000");
    origins.add("http://localhost:3001");
    origins.add("http://localhost:3002");
    origins.add("http://127.0.0.1:3000");
    origins.add("http://127.0.0.1:3001");
    origins.add("http://127.0.0.1:3002");
  }

  return origins;
}

function isAuthLoopPath(pathname) {
  if (!pathname || typeof pathname !== "string") return false;
  const clean = pathname.replace(/\/+$/, "").toLowerCase();
  return (
    clean === "/auth/login" ||
    clean === "/auth/signup" ||
    clean === "/login" ||
    clean === "/signup"
  );
}

export function safeRedirectUrl({ url, baseUrl }) {
  if (!url || typeof url !== "string") {
    return baseUrl;
  }

  const trimmed = url.trim();

  // Reject protocol-relative or backslash-tricked URLs (e.g. "//evil.com", "/\\evil.com", "\\evil.com")
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.startsWith("\\")) {
    return baseUrl;
  }

  // Safe relative paths (e.g. "/menu", "/checkout")
  if (trimmed.startsWith("/")) {
    try {
      const parsed = new URL(trimmed, "https://petprotocols.internal");
      if (parsed.origin !== "https://petprotocols.internal") {
        return baseUrl;
      }
      if (!parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//")) {
        return baseUrl;
      }
      if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
        return baseUrl;
      }
      // Prevent self-redirect loops back to login/signup
      if (isAuthLoopPath(parsed.pathname)) {
        return baseUrl;
      }
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch (_) {
      return baseUrl;
    }
  }

  try {
    const parsed = new URL(trimmed);

    // Only allow http: and https: protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return baseUrl;
    }

    // Prevent self-redirect loops back to login/signup
    if (isAuthLoopPath(parsed.pathname)) {
      return baseUrl;
    }

    const isProduction = process.env.NODE_ENV === "production";

    // Outside production, permit any localhost or 127.0.0.1 hostname
    if (!isProduction && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
      return trimmed;
    }

    // In production, strictly match configured allowed application origins
    const allowedOrigins = getAllowedRedirectOrigins(baseUrl);
    if (allowedOrigins.has(parsed.origin)) {
      return trimmed;
    }
  } catch (_) {
    return baseUrl;
  }

  return baseUrl;
}

const providers = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      loginType: { label: "Login Type", type: "text" },
    },
    async authorize(credentials, req) {
        try {
          await connectDB();
          const email = normalizeEmail(credentials?.email || "");
          const ip = getClientIp(req);

          // Protect against brute force & credential spraying attacks with sliding window
          const rateCheck = await isLoginRateLimited({ email, ip });
          if (rateCheck.limited) {
            throw new Error(`Too many failed login attempts. Please wait ${rateCheck.resetInSeconds} seconds before trying again.`);
          }

          if (!email) {
            await recordFailedLoginAttempt({ email: null, ip });
            throw new Error("Invalid email or password");
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

          // Auto-bootstrap superadmin only if explicitly configured in environment
          if (!user && email) {
            const configuredEmails = getConfiguredSuperadminEmails();
            const configuredPassword = process.env.SUPERADMIN_PASSWORD;

            const isAllowedSuperadmin =
              configuredEmails.length > 0 &&
              configuredEmails.includes(email);

            if (
              isAllowedSuperadmin &&
              configuredPassword &&
              typeof configuredPassword === "string" &&
              configuredPassword.trim().length > 0
            ) {
              if (credentials.password === configuredPassword) {
                const hashedPassword = await bcrypt.hash(configuredPassword, 12);
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
            await recordFailedLoginAttempt({ email, ip });
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
            const configuredEmails = getConfiguredSuperadminEmails();

            const isAllowed =
              configuredEmails.length > 0 &&
              configuredEmails.includes(email);

            if (!isAllowed) {
              await recordFailedLoginAttempt({ email, ip });
              throw new Error("Invalid email or password");
            }
          }

          if (!user.password) {
            const configuredPassword = process.env.SUPERADMIN_PASSWORD;
            if (
              user.role === "superadmin" &&
              configuredPassword &&
              typeof configuredPassword === "string" &&
              configuredPassword.trim().length > 0 &&
              credentials.password === configuredPassword
            ) {
              user.password = await bcrypt.hash(configuredPassword, 12);
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

          // Self-heal superadmin password if out of sync with explicitly configured SUPERADMIN_PASSWORD
          if (!isPasswordCorrect && user.role === "superadmin") {
            const configuredPassword = process.env.SUPERADMIN_PASSWORD;
            if (
              configuredPassword &&
              typeof configuredPassword === "string" &&
              configuredPassword.trim().length > 0 &&
              credentials.password === configuredPassword
            ) {
              user.password = await bcrypt.hash(configuredPassword, 12);
              isPasswordCorrect = true;
            }
          }

          if (!isPasswordCorrect) {
            await recordFailedLoginAttempt({ email, ip });
            throw new Error("Invalid email or password");
          }

          // Reset failed attempts counter upon successful credentials match
          await resetLoginAttempts({ email, ip });

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
    async jwt({ token, user, trigger, session: updateData }) {
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

      if (trigger === "update" && updateData) {
        if (updateData.name) token.name = updateData.name;
        if ("image" in updateData) {
          token.image = sanitizeTokenImage(updateData.image);
        }
      }

      // Refresh DB data on subsequent session calls (skip on initial sign-in since user is already freshly populated)
      if (!user && token.email) {
        try {
          await connectDB();
          const configuredSuperadminEmails = getConfiguredSuperadminEmails();
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
              configuredSuperadminEmails.length > 0 &&
              userEmails.some((e) => configuredSuperadminEmails.includes(e));

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
            token.image = sanitizeTokenImage(dbUser.image);
            if (dbUser.name) token.name = dbUser.name;
            token.staffRole = dbUser.staffRole || "Staff";
            token.staffRoles = dbUser.staffRoles?.length ? dbUser.staffRoles : [dbUser.staffRole || "Staff"];
            token.permissions = dbUser.permissions || [];
          }
        } catch (dbErr) {
          console.warn("[Auth JWT] Session DB refresh skipped due to database connection state:", dbErr?.message || dbErr);
          // Retain existing token claims so session remains active without throwing HTTP 500
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
        const configuredSuperadminEmails = getConfiguredSuperadminEmails();
        const isConfiguredSuperadmin = Boolean(
          configuredSuperadminEmails.length > 0 &&
          configuredSuperadminEmails.includes(email)
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
      return safeRedirectUrl({ url, baseUrl });
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
