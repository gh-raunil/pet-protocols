import mongoose from "mongoose";
import connectDB from "../lib/db.js";
import Restaurant from "../models/Restaurant.js";
import Feedback from "../models/Feedback.js";

async function run() {
  console.log("=== RESTAURANT RATINGS & REVIEWS DATA INTEGRITY MIGRATION ===");
  await connectDB();

  const restaurants = await Restaurant.find().lean();
  console.log(`Found ${restaurants.length} restaurants to inspect.\n`);

  let sanitizedCount = 0;
  let authenticPreservedCount = 0;

  for (const r of restaurants) {
    const feedbacks = await Feedback.find({ restaurant: r._id }).lean();
    const count = feedbacks.length;

    let targetRating = null;
    let targetNumRatings = 0;

    if (count > 0) {
      const sum = feedbacks.reduce((acc, f) => acc + (Number(f.rating) || 0), 0);
      targetRating = Number((sum / count).toFixed(1));
      targetNumRatings = count;
      authenticPreservedCount++;

      console.log(`[AUTHENTIC REVIEWS PRESERVED] "${r.name}" (${r.slug})`);
      console.log(`  Previous: rating=${r.rating}, numRatings=${r.numRatings}`);
      console.log(`  Updated:  rating=${targetRating}, numRatings=${targetNumRatings} (${count} real feedbacks)\n`);
    } else {
      sanitizedCount++;
      console.log(`[UNRATED RESTAURANT RESET] "${r.name}" (${r.slug})`);
      console.log(`  Previous: rating=${r.rating}, numRatings=${r.numRatings}`);
      console.log(`  Updated:  rating=null, numRatings=0 (0 reviews)\n`);
    }

    await Restaurant.updateOne(
      { _id: r._id },
      { $set: { rating: targetRating, numRatings: targetNumRatings } }
    );
  }

  console.log("=== MIGRATION SUMMARY ===");
  console.log(`Total restaurants inspected: ${restaurants.length}`);
  console.log(`Authentic rated restaurants preserved: ${authenticPreservedCount}`);
  console.log(`Unrated restaurants reset to null/0: ${sanitizedCount}`);
  console.log("=== MIGRATION COMPLETED SUCCESSFULLY ===");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
