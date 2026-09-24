import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
dotenv.config({ path: ".env.local" });

import connectDB from "./lib/db.js";
import Restaurant from "./models/Restaurant.js";
import User from "./models/User.js";
import Product from "./models/Product.js";
import Order from "./models/Order.js";
import Message from "./models/Message.js";

async function seed() {
  try {
    console.log("Connecting to MongoDB via connectDB...");
    await connectDB();
    console.log("Connected to MongoDB!");

    // Clear all existing collections
    console.log("Clearing existing data (Restaurants, Users, Products, Orders, Messages)...");
    await Restaurant.deleteMany({});
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Message.deleteMany({});

    const isProduction = process.env.NODE_ENV === "production";
    const superadminEmail = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim() || (isProduction ? null : "superadmin.petprotocols@gmail.com");

    if (isProduction) {
      if (!process.env.SUPERADMIN_EMAIL) {
        throw new Error("CRITICAL: SUPERADMIN_EMAIL environment variable is required in production.");
      }
      if (!process.env.SUPERADMIN_PASSWORD) {
        throw new Error("CRITICAL: SUPERADMIN_PASSWORD environment variable is required in production.");
      }
    }

    const rawPassword = process.env.SUPERADMIN_PASSWORD || (isProduction ? null : "rounak");
    if (!rawPassword) {
      throw new Error("Superadmin password must be specified via SUPERADMIN_PASSWORD.");
    }

    const superadminPassword = await bcrypt.hash(rawPassword, 12);

    // 1. Create Dedicated Superadmin
    console.log(`Creating dedicated Super Admin (${superadminEmail})...`);
    const superadmin = await User.create({
      name: "Platform Super Admin",
      email: superadminEmail,
      password: superadminPassword,
      role: "superadmin",
      status: "active",
      phone: "+91 99999 00000",
      image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200",
    });

    const isDemo = process.argv.includes("--demo");

    if (isDemo) {
      if (isProduction) {
        throw new Error("Demo seeding is prohibited in production environment.");
      }
      console.log("Seeding Demo Restaurant, Admin, and Products (--demo mode)...");

      // 2. Create Demo Restaurant
      const demoRestaurant = await Restaurant.create({
        name: "Burger & Co. Kitchen",
        slug: "burger-and-co",
        description: "Artisanal smash burgers, crispy sides, and fresh stone-baked pizzas crafted daily.",
        cuisineType: ["Burgers", "Pizza", "Fast Food", "Sides"],
        image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=500",
        bannerImage: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200",
        address: {
          street: "12 Connaught Place, Block C",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110001",
        },
        phone: "+91 98765 43210",
        email: "contact@burgerco.com",
        status: "active",
        rating: 4.9,
        isFeatured: true,
      });

      // 3. Create Restaurant Admin for Demo Restaurant
      const restaurantAdminPassword = await bcrypt.hash("rounak", 10);
      const restaurantAdmin = await User.create({
        name: "Vikram Mehta",
        email: "admin@flagship.com",
        password: restaurantAdminPassword,
        role: "restaurant_admin",
        restaurant: demoRestaurant._id,
        status: "active",
        phone: "+91 98111 22334",
      });

      // 4. Create Sample Products
      const sampleProducts = [
        {
          restaurant: demoRestaurant._id,
          name: "Double Smash Cheeseburger",
          description: "Double smashed prime patties, melted cheddar, caramelized onions, house truffle mayo.",
          price: 289,
          image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500",
          category: "Burger",
          type: "non-veg",
          isAvailable: true,
          isFeatured: true,
        },
        {
          restaurant: demoRestaurant._id,
          name: "Crispy Paneer Supreme Burger",
          description: "Cottage cheese patty crusted with spiced panko, mint garlic dressing, fresh lettuce.",
          price: 199,
          image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=500",
          category: "Burger",
          type: "veg",
          isAvailable: true,
          isFeatured: false,
        },
        {
          restaurant: demoRestaurant._id,
          name: "Fire-Roasted Margherita Pizza",
          description: "San Marzano marinara, fresh fior di latte mozzarella, basil leaves, extra virgin olive oil.",
          price: 349,
          image: "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=500",
          category: "Pizza",
          type: "veg",
          isAvailable: true,
          isFeatured: true,
        },
        {
          restaurant: demoRestaurant._id,
          name: "Peri-Peri Skin-On Fries",
          description: "Crispy hand-cut potatoes tossed in aromatic African bird's eye spice mix with chipotle dip.",
          price: 129,
          image: "https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500",
          category: "Fries",
          type: "veg",
          isAvailable: true,
          isFeatured: false,
        },
        {
          restaurant: demoRestaurant._id,
          name: "Steamed Himalayan Momos",
          description: "Delicate dumplings stuffed with minced vegetables, ginger, scallions, and fiery roasted tomato dip.",
          price: 159,
          image: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=500",
          category: "Momos",
          type: "veg",
          isAvailable: true,
          isFeatured: false,
        },
        {
          restaurant: demoRestaurant._id,
          name: "Chilled Mint Mojito Fizz",
          description: "Freshly muddled garden mint, sparkling soda, raw cane sugar, and Persian lime.",
          price: 99,
          image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500",
          category: "Cold Drinks",
          type: "veg",
          isAvailable: true,
          isFeatured: false,
        },
      ];

      await Product.insertMany(sampleProducts);

      // 5. Create Demo Customer
      const customerPassword = await bcrypt.hash("rounak", 10);
      await User.create({
        name: "Rahul Verma",
        email: "customer@petprotocols.com",
        password: customerPassword,
        role: "customer",
        status: "active",
        phone: "+91 97777 88888",
      });

      // 6. Create Initial Live Superadmin Broadcast Messages
      console.log("Creating Sample Superadmin Messages...");
      await Message.insertMany([
        {
          title: "Multi-Admin branch delegation is live across all kitchens",
          content: "Platform Owner announcement: Each restaurant now supports multiple admin and kitchen manager logins with independent audit trails.",
          messageType: "announcement",
          priority: "high",
          recipientType: "restaurants",
          recipientSelection: "all",
          status: "sent",
          sentAt: new Date(),
          createdBy: superadmin._id,
        },
        {
          title: "15-Minute Kitchen Preparation SLA Standard Mandatory",
          content: "Orders must be acknowledged within 2 minutes and transitioned to 'Preparing'. Packaging must feature Pet Protocols thermal double-seals prior to dispatch handover.",
          messageType: "important",
          priority: "high",
          recipientType: "restaurants",
          recipientSelection: "all",
          status: "sent",
          sentAt: new Date(Date.now() - 3600000 * 24),
          createdBy: superadmin._id,
        },
        {
          title: "Snapshot Pricing & Dynamic Revenue Protection Live",
          content: "Historical customer orders are now permanently snapshot-locked. You can update menu prices anytime without altering past transactional records.",
          messageType: "general",
          priority: "normal",
          recipientType: "restaurants",
          recipientSelection: "all",
          status: "sent",
          sentAt: new Date(Date.now() - 3600000 * 48),
          createdBy: superadmin._id,
        },
        {
          title: "Zero platform commission active for newly onboarded kitchens",
          content: "Enjoy 0% platform take-rate for your first 30 days of active dispatch. Maximize kitchen throughput during evening prime hours.",
          messageType: "promotion",
          priority: "normal",
          recipientType: "restaurants",
          recipientSelection: "all",
          status: "sent",
          sentAt: new Date(Date.now() - 3600000 * 72),
          createdBy: superadmin._id,
        },
      ]);

      console.log("=========================================");
      console.log("DATABASE SEEDED WITH DEMO TENANT & MENU");
      console.log(`Superadmin Email:     ${superadminEmail} (Role: SUPERADMIN)`);
      console.log("Restaurant Admin:     admin@flagship.com (Port 3001)");
      console.log("Customer Account:     customer@petprotocols.com (Port 3000)");
      console.log("Restaurant Created:   Burger & Co. Kitchen (slug: burger-and-co)");
      console.log("Dishes Created:       6 menu items across 5 categories");
      console.log("=========================================");
    } else {
      console.log("=========================================");
      console.log("DATABASE SEEDED WITH ONLY DEDICATED SUPERADMIN");
      console.log(`Superadmin Email: ${superadminEmail}`);
      console.log("Role:             SUPERADMIN");
      if (!isProduction) {
        console.log("Tip: Run `npm run seed:demo` or `node seed.js --demo` to include sample restaurant & dishes in development.");
      }
      console.log("=========================================");
    }

    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

seed();