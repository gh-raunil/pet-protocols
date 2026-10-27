import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import connectDB from '../lib/db.js';
import Product from '../models/Product.js';

async function migrateRatings() {
  await connectDB();
  console.log('=== PRODUCT RATINGS & REVIEWS DATA INTEGRITY MIGRATION ===');

  const products = await Product.find({});
  console.log(`Found ${products.length} products to inspect.\n`);

  for (const product of products) {
    const reviews = Array.isArray(product.reviews) ? product.reviews : [];
    const prevRating = product.rating;
    const prevNum = product.numRatings;

    if (reviews.length > 0) {
      // Product has genuine review data — calculate authentic average and count
      const totalStars = reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
      const authenticRating = Number((totalStars / reviews.length).toFixed(1));
      const authenticCount = reviews.length;

      await Product.updateOne(
        { _id: product._id },
        { $set: { rating: authenticRating, numRatings: authenticCount } }
      );

      console.log(`[AUTHENTIC REVIEWS PRESERVED] "${product.name}"`);
      console.log(`  Previous: rating=${prevRating}, numRatings=${prevNum}`);
      console.log(`  Updated:  rating=${authenticRating}, numRatings=${authenticCount} (${reviews.length} actual reviews)\n`);
    } else {
      // Product has 0 reviews — remove artificial schema default (4.8 / 12)
      await Product.updateOne(
        { _id: product._id },
        { $set: { rating: null, numRatings: 0 } }
      );

      console.log(`[UNRATED PRODUCT RESET] "${product.name}"`);
      console.log(`  Previous: rating=${prevRating}, numRatings=${prevNum}`);
      console.log(`  Updated:  rating=null, numRatings=0 (0 reviews)\n`);
    }
  }

  console.log('=== MIGRATION COMPLETED SUCCESSFULLY ===');
  process.exit(0);
}

migrateRatings().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
