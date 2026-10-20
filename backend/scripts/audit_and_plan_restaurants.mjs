import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import connectDB from '../lib/db.js';
import Restaurant from '../models/Restaurant.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Offer from '../models/Offer.js';
import Ingredient from '../models/Ingredient.js';
import StockMovement from '../models/StockMovement.js';
import Purchase from '../models/Purchase.js';
import Waste from '../models/Waste.js';
import Supplier from '../models/Supplier.js';
import Recipe from '../models/Recipe.js';
import PaymentIntent from '../models/PaymentIntent.js';

async function audit() {
  await connectDB();
  console.log('=== AUDITING ALL RESTAURANTS IN DATABASE ===');
  
  const restaurants = await Restaurant.find({}).lean();
  console.log(`Total restaurants found: ${restaurants.length}\n`);

  const report = [];

  for (const r of restaurants) {
    const id = r._id;
    const [
      productsCount,
      ordersCount,
      usersCount,
      offersCount,
      ingredientsCount,
      movementsCount,
      purchasesCount,
      wasteCount,
      suppliersCount,
      recipesCount,
      paymentIntentsCount
    ] = await Promise.all([
      Product.countDocuments({ restaurant: id }),
      Order.countDocuments({ restaurant: id }),
      User.countDocuments({ restaurant: id }),
      Offer.countDocuments({ restaurant: id }),
      Ingredient.countDocuments({ restaurant: id }),
      StockMovement.countDocuments({ restaurant: id }),
      Purchase.countDocuments({ restaurant: id }),
      Waste.countDocuments({ restaurant: id }),
      Supplier.countDocuments({ restaurant: id }),
      Recipe.countDocuments({ restaurant: id }),
      PaymentIntent.countDocuments({ restaurant: id }),
    ]);

    report.push({
      id: String(id),
      name: r.name,
      slug: r.slug,
      status: r.status,
      isOpen: r.isOpen,
      acceptingOrders: r.acceptingOrders,
      createdAt: r.createdAt,
      productsCount,
      ordersCount,
      usersCount,
      offersCount,
      ingredientsCount,
      movementsCount,
      purchasesCount,
      wasteCount,
      suppliersCount,
      recipesCount,
      paymentIntentsCount,
    });
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

audit().catch((err) => {
  console.error(err);
  process.exit(1);
});
