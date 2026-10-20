import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import connectDB from '../lib/db.js';
import Restaurant from '../models/Restaurant.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import User from '../models/User.js';

async function checkDetails() {
  await connectDB();
  const unwantedIds = [
    '6acf8717dc4ed3ad8f24b50b',
    '6acf88825fb2150679c60996',
    '6ad4f698dd6fd0e438e3ac6c',
    '6ad4f699dd6fd0e438e3ac6d',
    '6ad5d0a6fd106baaa4e6834f',
  ];

  for (const id of unwantedIds) {
    const rest = await Restaurant.findById(id).lean();
    console.log(`\n==================================================`);
    console.log(`Restaurant: ${rest?.name} (${id}) - Status: ${rest?.status}`);
    const orders = await Order.find({ restaurant: id }).select('orderNumber status totalAmount createdAt items payment').lean();
    const products = await Product.find({ restaurant: id }).select('name price category isAvailable').lean();
    const users = await User.find({ restaurant: id }).select('name email role status').lean();

    console.log('Orders:', JSON.stringify(orders, null, 2));
    console.log('Products:', JSON.stringify(products, null, 2));
    console.log('Users:', JSON.stringify(users, null, 2));
  }

  process.exit(0);
}

checkDetails().catch((err) => {
  console.error(err);
  process.exit(1);
});
