const mongoose = require('mongoose');
const dns = require('node:dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pet-protocols';

const defaultCategories = [
  {
    name: "Burger",
    slug: "burger",
    icon: "🍔",
    description: "Juicy handcrafted burgers with fresh patties and gourmet buns",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80",
    isActive: true,
  },
  {
    name: "Pizza",
    slug: "pizza",
    icon: "🍕",
    description: "Wood-fired artisanal pizzas with melted mozzarella and fresh toppings",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80",
    isActive: true,
  },
  {
    name: "Fries",
    slug: "fries",
    icon: "🍟",
    description: "Crispy golden fries, peri-peri seasoned wedges and loaded sides",
    image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&auto=format&fit=crop&q=80",
    isActive: true,
  },
  {
    name: "Cold Drinks",
    slug: "cold-drinks",
    icon: "🥤",
    description: "Chilled mocktails, fizzy sodas, iced teas, and refreshing shakes",
    image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80",
    isActive: true,
  },
  {
    name: "Momos",
    slug: "momos",
    icon: "🥟",
    description: "Steamed, pan-fried and tandoori dumplings served with spicy chutney",
    image: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&auto=format&fit=crop&q=80",
    isActive: true,
  },
  {
    name: "Soup",
    slug: "soup",
    icon: "🍲",
    description: "Warm, nourishing and savory broths prepared with fresh ingredients",
    image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80",
    isActive: true,
  },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const collection = mongoose.connection.collection('categories');

    for (const cat of defaultCategories) {
      const existing = await collection.findOne({
        $or: [
          { name: { $regex: `^${cat.name}$`, $options: "i" } },
          { slug: cat.slug }
        ]
      });

      if (existing) {
        await collection.updateOne(
          { _id: existing._id },
          {
            $set: {
              name: cat.name,
              slug: cat.slug,
              icon: cat.icon,
              description: cat.description,
              image: cat.image,
              isActive: true,
              restaurant: existing.restaurant || null,
              restaurantName: existing.restaurantName || "Platform-Wide",
              updatedAt: new Date()
            }
          }
        );
        console.log(`Updated category: ${cat.name} with image: ${cat.image}`);
      } else {
        await collection.insertOne({
          ...cat,
          restaurant: null,
          restaurantName: "Platform-Wide",
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`Created category: ${cat.name}`);
      }
    }

    console.log("Category seeding completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
}

seed();
