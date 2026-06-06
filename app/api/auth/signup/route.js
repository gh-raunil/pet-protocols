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

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "All fields are required",
        },
        { status: 400 },
      );
    }

    // Check Existing User
    const existingUser = await User.findOne({
      email,
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

    // Create User
    const user = await User.create({
      name,

      email,

      password: hashedPassword,
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
