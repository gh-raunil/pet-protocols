import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import connectDB from '../lib/db.js';
import Restaurant from '../models/Restaurant.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Ingredient from '../models/Ingredient.js';
import StockMovement from '../models/StockMovement.js';
import Recipe from '../models/Recipe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.resolve(__dirname, '../backups');

const TARGET_UNWANTED_IDS = [
  '6acf8717dc4ed3ad8f24b50b', // TEST_PHASE2A_RestB
  '6acf88825fb2150679c60996', // TEST_PHASE2A_RestB
  '6ad4f698dd6fd0e438e3ac6c', // Phase 2 Kitchen Alpha
  '6ad4f699dd6fd0e438e3ac6d', // Phase 2 Kitchen Beta
  '6ad5d0a6fd106baaa4e6834f', // Delivery Role Auth Kitchen
];

const INTENDED_IDS = [
  '6acf3b48e2de65db116e0b81', // Burger & Co. Kitchen
  '6ad2152c01d82b40b10f8c94', // Shivam Bhog
];

async function runCleanup() {
  await connectDB();
  console.log('--- RESTAURANT SAFE CLEANUP & AUDIT ARCHIVE ---');

  // 1. Verify existence of target records
  const unwantedRestaurants = await Restaurant.find({ _id: { $in: TARGET_UNWANTED_IDS } }).lean();
  console.log(`Found ${unwantedRestaurants.length} of ${TARGET_UNWANTED_IDS.length} target unwanted restaurants.`);

  if (unwantedRestaurants.length === 0) {
    console.log('No unwanted restaurants found. They may have already been cleaned up.');
    process.exit(0);
  }

  // 2. Collect all dependencies for backup
  const backupData = {
    timestamp: new Date().toISOString(),
    description: 'Pre-cleanup snapshot of test/staging restaurants and dependencies',
    restaurants: unwantedRestaurants,
    products: await Product.find({ restaurant: { $in: TARGET_UNWANTED_IDS } }).lean(),
    orders: await Order.find({ restaurant: { $in: TARGET_UNWANTED_IDS } }).lean(),
    users: await User.find({ restaurant: { $in: TARGET_UNWANTED_IDS } }).lean(),
    ingredients: await Ingredient.find({ restaurant: { $in: TARGET_UNWANTED_IDS } }).lean(),
    stockMovements: await StockMovement.find({ restaurant: { $in: TARGET_UNWANTED_IDS } }).lean(),
    recipes: await Recipe.find({ restaurant: { $in: TARGET_UNWANTED_IDS } }).lean(),
  };

  // 3. Write backup to disk
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const backupFilename = `restaurant_cleanup_backup_${Date.now()}.json`;
  const backupFilePath = path.join(BACKUP_DIR, backupFilename);
  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');

  const stats = fs.statSync(backupFilePath);
  console.log(`✅ Backup successfully saved to ${backupFilePath} (${stats.size} bytes)`);

  // 4. Safely archive unwanted restaurants:
  // Case B compliance: Preserve all orders, products, recipes, movements in DB for audit history.
  // Set status: 'archived', isOpen: false, acceptingOrders: false, isFeatured: false.
  // Mark products isAvailable: false.
  console.log('Archiving unwanted restaurants and marking items unavailable...');
  const restUpdateResult = await Restaurant.updateMany(
    { _id: { $in: TARGET_UNWANTED_IDS } },
    {
      $set: {
        status: 'archived',
        isOpen: false,
        acceptingOrders: false,
        isFeatured: false,
      },
    }
  );
  console.log(`Archived restaurants: ${restUpdateResult.modifiedCount}`);

  const prodUpdateResult = await Product.updateMany(
    { restaurant: { $in: TARGET_UNWANTED_IDS } },
    {
      $set: {
        isAvailable: false,
      },
    }
  );
  console.log(`Updated products to unavailable: ${prodUpdateResult.modifiedCount}`);

  // 5. Verification:
  console.log('\n--- VERIFICATION OF REMAINING ACTIVE RESTAURANTS ---');
  const activeRestaurants = await Restaurant.find({ status: 'active' }).lean();
  console.log(`Total active restaurants in DB: ${activeRestaurants.length}`);
  activeRestaurants.forEach((r) => {
    console.log(` - [${r._id}] ${r.name} (slug: ${r.slug})`);
  });

  const activeIds = activeRestaurants.map((r) => String(r._id));
  const expectedNames = ['Burger & Co. Kitchen', 'Shivam Bhog'];
  const matchesExpected =
    activeRestaurants.length === 2 &&
    activeRestaurants.every((r) => expectedNames.includes(r.name));

  if (!matchesExpected) {
    throw new Error(`CRITICAL: Active restaurants list does not strictly match intended 2 restaurants! Found: ${activeRestaurants.map(r => r.name).join(', ')}`);
  }

  console.log('✅ STRICT VERIFICATION PASSED: Only "Burger & Co. Kitchen" and "Shivam Bhog" are active!');
  process.exit(0);
}

runCleanup().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
