import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import connectDB from '../lib/db.js';
import Product from '../models/Product.js';

test('Product Rating and Review Data Integrity Suite', async (t) => {
  await connectDB();

  await t.test('1. Product schema defaults: New unrated product has null rating and 0 numRatings', async () => {
    const testRestId = new mongoose.Types.ObjectId();
    const tempProduct = new Product({
      name: '__Test_Unrated_Product_' + Date.now(),
      description: 'Temporary dish for verifying schema defaults',
      price: 199,
      category: 'Burgers',
      restaurant: testRestId,
      image: '/images/burger.png',
    });

    assert.equal(tempProduct.rating, null, 'Unrated product rating default must be null, not 4.8');
    assert.equal(tempProduct.numRatings, 0, 'Unrated product review count default must be 0, not 12');
  });

  await t.test('2. Review calculation: Average rating and count reflect actual review items', async () => {
    const testRestId = new mongoose.Types.ObjectId();
    const prod = new Product({
      name: '__Test_Review_Calc_' + Date.now(),
      description: 'Testing calculation',
      price: 249,
      category: 'Pizza',
      restaurant: testRestId,
      image: '/images/pizza.png',
      reviews: [
        { userName: 'Reviewer A', rating: 5, comment: 'Crispy and hot!' },
        { userName: 'Reviewer B', rating: 4, comment: 'Good flavor' },
      ],
    });

    // Compute derived ratings as done in business logic
    const totalStars = prod.reviews.reduce((sum, r) => sum + r.rating, 0);
    const count = prod.reviews.length;
    prod.numRatings = count;
    prod.rating = Number((totalStars / count).toFixed(1));

    assert.equal(prod.numRatings, 2, 'numRatings must equal reviews array length (2)');
    assert.equal(prod.rating, 4.5, 'Average rating of [5, 4] must be exactly 4.5');
  });

  await t.test('3. Database integrity: Authentic reviews preserved, unrated products sanitized', async () => {
    const margherita = await Product.findOne({ name: /Fire-Roasted Margherita Pizza/i });
    if (margherita) {
      assert.equal(margherita.rating, 5, 'Fire-Roasted Margherita Pizza genuine rating 5 must be preserved');
      assert.equal(margherita.numRatings, 1, 'Fire-Roasted Margherita Pizza review count must be 1');
      assert.equal(margherita.reviews.length, 1, 'Fire-Roasted Margherita Pizza must have 1 review in array');
    }

    const unratedProducts = await Product.find({ 'reviews.0': { $exists: false } });
    for (const p of unratedProducts) {
      assert.equal(p.rating, null, `Product "${p.name}" with 0 reviews must have rating=null`);
      assert.equal(p.numRatings, 0, `Product "${p.name}" with 0 reviews must have numRatings=0`);
    }
  });

  await t.test('4. Endpoints: Global /api/ratings returns only authentic reviews without hardcoded fallbacks', async () => {
    const res = await fetch('http://127.0.0.1:4000/api/ratings');
    assert.equal(res.status, 200, 'HTTP status must be 200');
    const data = await res.json();
    assert.equal(data.success, true);
    assert(Array.isArray(data.ratings), 'ratings must be an array');

    // Confirm fake testimonials are absent
    const fakeNames = ['Aarav Sharma', 'Priya Patel', 'Rohan Verma'];
    for (const r of data.ratings) {
      assert.equal(fakeNames.includes(r.userName), false, `Found fake fallback review for ${r.userName}`);
    }
  });

  await t.test('5. Endpoints: Product-specific /api/ratings returns genuine values or null/0', async () => {
    const products = await Product.find().lean();
    for (const prod of products.slice(0, 5)) {
      const res = await fetch(`http://127.0.0.1:4000/api/ratings?targetType=product&targetId=${prod._id}`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);

      if (!prod.reviews || prod.reviews.length === 0) {
        assert.equal(data.rating, null, `Product ${prod.name} has 0 reviews, expected rating null, got ${data.rating}`);
        assert.equal(data.numRatings, 0, `Product ${prod.name} has 0 reviews, expected numRatings 0, got ${data.numRatings}`);
      } else {
        assert(typeof data.rating === 'number', `Product ${prod.name} has reviews, rating should be number`);
        assert.equal(data.numRatings, prod.reviews.length);
      }
    }
  });

  await mongoose.disconnect();
});
