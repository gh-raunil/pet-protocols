import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pet-protocols";

async function main() {
  console.log("Connecting to:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  // Import models
  const { default: Order } = await import("../models/Order.js");
  const { default: Product } = await import("../models/Product.js");

  // Sync indexes
  console.log("Syncing Order indexes...");
  await Order.syncIndexes();
  const orderIndexes = await Order.collection.indexes();
  console.log("Order indexes:", JSON.stringify(orderIndexes, null, 2));

  console.log("Syncing Product indexes...");
  await Product.syncIndexes();
  const productIndexes = await Product.collection.indexes();
  console.log("Product indexes:", JSON.stringify(productIndexes, null, 2));

  await mongoose.disconnect();
  console.log("Database index verification completed successfully!");
}

main().catch((err) => {
  console.error("Error verifying indexes:", err);
  process.exit(1);
});
