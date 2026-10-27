import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { isValidEmail, normalizeEmail, validatePassword } from "@/lib/validation";
import { checkSignupRateLimit } from "@/lib/rateLimit";

export async function POST(request) {
  try {
    // 1. Rate Limiting Protection (Sliding-window: max 5 signups / 15m per IP)
    const rateLimit = await checkSignupRateLimit(request);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Too many registration attempts. Please wait ${rateLimit.resetInSeconds} seconds before trying again.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.resetInSeconds),
          },
        }
      );
    }

    // 2. Parse Request Body
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request payload.",
        },
        { status: 400 }
      );
    }

    const { name, email, password } = body;

    // 3. Name Validation
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter your full name.",
        },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      return NextResponse.json(
        {
          success: false,
          message: "Name must not exceed 100 characters.",
        },
        { status: 400 }
      );
    }

    // 4. Email Format Validation & Consistent Normalization
    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid email address.",
        },
        { status: 400 }
      );
    }
    const normalizedEmail = normalizeEmail(email);

    // 5. Password Security & DoS Protection (8-72 characters)
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          message: passwordCheck.message,
        },
        { status: 400 }
      );
    }

    // Connect Database
    await connectDB();

    // 6. Superadmin Email Protection (Prevent unauthorized reservation)
    const configuredSuperadminEmails = (process.env.SUPERADMIN_EMAIL || "")
      .toLowerCase()
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    if (
      configuredSuperadminEmails.includes(normalizedEmail) ||
      normalizedEmail === "superadmin.petprotocols@gmail.com" ||
      normalizedEmail === "superadmin@petprotocols.com"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Registration with this email address is not permitted via public signup.",
        },
        { status: 400 }
      );
    }

    // 7. Check Existing User
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "An account with this email address already exists. Please log in or use a different email.",
        },
        { status: 400 }
      );
    }

    // 8. Secure Password Hashing (bcrypt with 12 rounds)
    const hashedPassword = await bcrypt.hash(password, 12);

    // 9. Create User — Strictly enforce customer role & active status
    const user = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: "customer",
      status: "active",
    });

    // 10. Success Response (Exposes only non-sensitive safe user identifiers)
    return NextResponse.json({
      success: true,
      message: "Account created successfully! You can now log in.",
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error?.message || error);
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred while creating your account. Please try again.",
      },
      { status: 500 }
    );
  }
}
