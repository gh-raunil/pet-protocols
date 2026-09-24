import { NextResponse } from "next/server";

import bcrypt from "bcryptjs";

import connectDB from "@/lib/db";

import User from "@/models/User";

export async function POST(request) {
  try {
    // Connect Database
    await connectDB();

    // Get Request Body
    const body = await request.json();

    const { name, email, password } = body;
    const normalizedEmail = email?.toLowerCase().trim();

    // Validation
    if (!name || !normalizedEmail || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "All fields are required",
        },
        { status: 400 },
      );
    }

    // Do not permit public signup using the dedicated superadmin email
    const configuredSuperadminEmail = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
    if (configuredSuperadminEmail && normalizedEmail === configuredSuperadminEmail) {
      return NextResponse.json(
        {
          success: false,
          message: "Registration with this email address is not permitted via public signup.",
        },
        { status: 400 },
      );
    }

    // Check Existing User
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "User already exists",
        },
        { status: 400 },
      );
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create User — always strictly enforce customer role
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "customer",
      status: "active",
    });

    // Success Response
    return NextResponse.json({
      success: true,

      message: "User created successfully",

      user: {
        id: user._id,

        name: user.name,

        email: user.email,
      },
    });
  } catch (error) {
    console.log(error);

    return NextResponse.json(
      {
        success: false,
        message: "Server Error",
      },
      { status: 500 },
    );
  }
}
