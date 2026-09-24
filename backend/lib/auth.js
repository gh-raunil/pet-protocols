import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Restaurant from "@/models/Restaurant";
import bcrypt from "bcryptjs";

// Handle both ESM and CommonJS default exports safely
const Google = GoogleProvider?.default || GoogleProvider;
const Credentials = CredentialsProvider?.default || CredentialsProvider;

const providers = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
        try {
          await connectDB();
          const email = credentials.email?.toLowerCase().trim();
          const user = await User.findOne({ email }).populate("restaurant");

          if (!user) {
            throw new Error("Invalid email or password");
          }

          if (user.status === "suspended") {
            throw new Error("Your account has been suspended. Please contact platform support.");
          }

          // If account has superadmin role, strictly verify email matches configured SUPERADMIN_EMAIL
          if (user.role === "superadmin") {
            const configuredSuperadminEmail = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
            if (configuredSuperadminEmail && email !== configuredSuperadminEmail) {
              throw new Error("Invalid email or password");
            }
          }

          if (!user.password) {
            throw new Error("Please login with Google");
          }

          const isPasswordCorrect = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordCorrect) {
            throw new Error("Invalid email or password");
          }

          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            restaurantId: user.restaurant ? user.restaurant._id.toString() : null,
            restaurantName: user.restaurant ? user.restaurant.name : null,
            image: user.image,
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
        token.image = user.image;
      }

      // Refresh DB data
      if (token.email) {
        await connectDB();
        const configuredSuperadminEmail = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
        const dbUser = await User.findOne({ email: token.email.toLowerCase().trim() }).populate("restaurant");
        if (dbUser) {
          if (dbUser.role === "superadmin" && configuredSuperadminEmail && dbUser.email !== configuredSuperadminEmail) {
            token.role = "customer"; // Demote unauthorized email attempting superadmin
          } else {
            token.role = dbUser.role;
          }
          token.id = dbUser._id.toString();
          token.status = dbUser.status;
          token.restaurantId = dbUser.restaurant ? dbUser.restaurant._id.toString() : null;
          token.restaurantName = dbUser.restaurant ? dbUser.restaurant.name : null;
          token.image = dbUser.image || token.image;
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
        session.user.image = token.image;
      }
      return session;
    },

    async signIn({ user, account }) {
      if (account.provider === "google") {
        await connectDB();
        const email = user.email?.toLowerCase().trim();
        const configuredSuperadminEmail = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
        const isConfiguredSuperadmin = Boolean(configuredSuperadminEmail && email === configuredSuperadminEmail);

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
  },

  pages: { signIn: "/auth/login" },
  session: { strategy: "jwt", maxAge: 30 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};

if (!process.env.NEXTAUTH_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("CRITICAL: NEXTAUTH_SECRET is required in production environment.");
}

export default authOptions;
