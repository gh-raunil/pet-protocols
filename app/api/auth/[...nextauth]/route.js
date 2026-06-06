import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import connectDB from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),

    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          await connectDB();
          const user = await User.findOne({ email: credentials.email });
          if (!user) throw new Error("User not found");
          if (!user.password) throw new Error("Please login with Google");
          const isPasswordCorrect = await bcrypt.compare(
            credentials.password,
            user.password
          );
          if (!isPasswordCorrect) throw new Error("Invalid password");
          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            image: user.image,
          };
        } catch (error) {
          throw new Error(error.message);
        }
      },
    }),
  ],

  callbacks: {
    // ← Always fetch fresh role from DB
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.image = user.image;
      }

      // For Google users — fetch role from DB every time
      if (token.email) {
        await connectDB();
        const dbUser = await User.findOne({ email: token.email })
        if (dbUser) {
          token.role = dbUser.role
          token.id = dbUser._id.toString()
          token.image = dbUser.image || token.image
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.image = token.image;
      }
      return session;
    },

    // ← Attach role to Google user object
    async signIn({ user, account }) {
      if (account.provider === "google") {
        await connectDB();
        const existingUser = await User.findOne({ email: user.email });
        if (!existingUser) {
          const newUser = await User.create({
            name: user.name,
            email: user.email,
            image: user.image,
          });
          user.role = newUser.role
          user.id = newUser._id.toString()
        } else {
          // ← This is what was missing!
          user.role = existingUser.role
          user.id = existingUser._id.toString()
        }
      }
      return true;
    },
  },

  pages: { signIn: "/auth/login" },
  session: { strategy: "jwt", maxAge: 30 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };