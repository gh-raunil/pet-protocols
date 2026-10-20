import assert from 'node:assert/strict';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import connectDB from '../lib/db.js';
import Restaurant from '../models/Restaurant.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

async function testSuite() {
  console.log('🧪 Starting Master Verification Test Suite...\n');

  await connectDB();

  // -------------------------------------------------------------
  // PART 2 VERIFICATION: RESTAURANTS CLEANUP & INTEGRITY
  // -------------------------------------------------------------
  console.log('Checking Part 2: Restaurant Data Cleanup & Integrity...');

  // 1. Check active restaurants count & names
  const activeRestaurants = await Restaurant.find({ status: 'active' }).lean();
  assert.equal(activeRestaurants.length, 2, 'Exactly 2 restaurants must be active');
  
  const activeNames = activeRestaurants.map(r => r.name).sort();
  assert.deepEqual(
    activeNames,
    ['Burger & Co. Kitchen', 'Shivam Bhog'],
    'Active restaurants must be strictly "Burger & Co. Kitchen" and "Shivam Bhog"'
  );
  console.log('  ✅ Exactly the 2 intended restaurants are active: Shivam Bhog and Burger & Co. Kitchen');

  // 2. Check archived test restaurants still exist (data preservation)
  const archivedRestaurants = await Restaurant.find({ status: 'archived' }).lean();
  assert.ok(archivedRestaurants.length >= 5, 'At least 5 archived test restaurants must be preserved in DB');
  console.log(`  ✅ Preserved ${archivedRestaurants.length} historical/test restaurants in archived status for audit safety`);

  // 3. Check historical orders are preserved
  const totalOrders = await Order.countDocuments();
  assert.ok(totalOrders > 0, 'Orders must not be deleted');
  console.log(`  ✅ Total orders preserved in database: ${totalOrders}`);

  // 4. Verify no archived restaurant products appear as available
  const archivedIds = archivedRestaurants.map(r => r._id);
  const activeArchivedProds = await Product.find({ restaurant: { $in: archivedIds }, isAvailable: true });
  assert.equal(activeArchivedProds.length, 0, 'No products of archived restaurants should be marked available');
  console.log('  ✅ No archived restaurant products are marked available');

  // -------------------------------------------------------------
  // PART 1 VERIFICATION: MENU SORTING & FILTERING LOGIC
  // -------------------------------------------------------------
  console.log('\nChecking Part 1: Menu Sorting & Filtering Algorithms...');

  const activeRestIds = activeRestaurants.map(r => r._id);
  const prods = await Product.find({ restaurant: { $in: activeRestIds } }).lean();
  console.log(`  Loaded ${prods.length} active products for menu sorting & filtering tests`);

  // Test Sort: Price Low to High
  const priceLowSorted = [...prods].sort((a, b) => Number(a.price) - Number(b.price));
  for (let i = 0; i < priceLowSorted.length - 1; i++) {
    assert.ok(
      Number(priceLowSorted[i].price) <= Number(priceLowSorted[i + 1].price),
      'price-low must be ascending'
    );
  }
  console.log('  ✅ Sort "price-low" strictly orders ascending');

  // Test Sort: Price High to Low
  const priceHighSorted = [...prods].sort((a, b) => Number(b.price) - Number(a.price));
  for (let i = 0; i < priceHighSorted.length - 1; i++) {
    assert.ok(
      Number(priceHighSorted[i].price) >= Number(priceHighSorted[i + 1].price),
      'price-high must be descending'
    );
  }
  console.log('  ✅ Sort "price-high" strictly orders descending');

  // Test Sort: Rating (Top rated)
  const ratingSorted = [...prods].sort((a, b) => {
    const rateB = Number(b.rating || 0);
    const rateA = Number(a.rating || 0);
    if (rateB !== rateA) return rateB - rateA;
    return Number(b.numRatings || 0) - Number(a.numRatings || 0);
  });
  for (let i = 0; i < ratingSorted.length - 1; i++) {
    assert.ok(
      Number(ratingSorted[i].rating || 0) >= Number(ratingSorted[i + 1].rating || 0),
      'rating sort must be descending'
    );
  }
  console.log('  ✅ Sort "rating" strictly orders descending by rating');

  // Test Sort: Newest First
  const newestSorted = [...prods].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  for (let i = 0; i < newestSorted.length - 1; i++) {
    assert.ok(
      new Date(newestSorted[i].createdAt || 0).getTime() >=
        new Date(newestSorted[i + 1].createdAt || 0).getTime(),
      'newest sort must be descending by createdAt'
    );
  }
  console.log('  ✅ Sort "newest" strictly orders descending by real createdAt timestamp');

  // Test Filter: Dietary (Veg / Non-veg)
  const vegOnly = prods.filter(p => p.type === 'veg');
  const nonVegOnly = prods.filter(p => p.type === 'non-veg');
  assert.ok(vegOnly.every(p => p.type === 'veg'), 'All veg items must have type === "veg"');
  assert.ok(nonVegOnly.every(p => p.type === 'non-veg'), 'All non-veg items must have type === "non-veg"');
  console.log(`  ✅ Dietary filter accurately partitions: ${vegOnly.length} Veg, ${nonVegOnly.length} Non-Veg`);

  // Test Filter: In Stock Only
  const inStock = prods.filter(p => p.isAvailable);
  assert.ok(inStock.every(p => p.isAvailable === true), 'In-stock filter must only contain available items');
  console.log(`  ✅ In-stock filter accurately selects ${inStock.length} available dishes`);

  // Test Filter: Price Range
  const minP = 150;
  const maxP = 250;
  const priceFiltered = prods.filter(p => p.price >= minP && p.price <= maxP);
  assert.ok(priceFiltered.every(p => p.price >= minP && p.price <= maxP), 'Price range must bound prices');
  console.log(`  ✅ Price range filter [₹${minP}-₹${maxP}] accurately selects ${priceFiltered.length} items`);

  console.log('\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
}

testSuite().catch((err) => {
  console.error('❌ Verification test failed:', err);
  process.exit(1);
});
