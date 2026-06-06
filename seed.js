import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;

const ProductSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
    price: Number,
    image: String,
    category: String,
    isAvailable: Boolean,
    isFeatured: Boolean,
    type: String,
  },
  { timestamps: true }
);

const Product =
  mongoose.models.Product || mongoose.model("Product", ProductSchema);

const products = [

  // ── BURGERS (6 veg) ──────────────────────────────────────────────────────
  {
    name: "Aloo Tikki Burger",
    description: "Crispy spiced potato patty with mint chutney, onions, and tangy tamarind sauce in a soft bun.",
    price: 129,
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500",
    category: "Burger",
    isAvailable: false,
    isFeatured: true,
    type: "veg",
  },
  {
    name: "Paneer Tikka Burger",
    description: "Juicy grilled paneer patty marinated in tandoori spices with coleslaw and garlic mayo.",
    price: 179,
    image: "https://images.unsplash.com/photo-1550317138-10000687a72b?w=500",
    category: "Burger",
    isAvailable: true,
    isFeatured: true,
    type: "veg",
  },
  {
    name: "Crispy Corn Burger",
    description: "Golden corn and cheese patty with shredded lettuce, tomato, and smoky mayo sauce.",
    price: 149,
    image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=500",
    category: "Burger",
    isAvailable: true,
    isFeatured: false,
    type: "veg",
  },
  {
    name: "Mushroom Swiss Burger",
    description: "Sautéed mushrooms with melted Swiss cheese, caramelised onions, and herb mayo in a brioche bun.",
    price: 199,
    image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=500",
    category: "Burger",
    isAvailable: true,
    isFeatured: false,
    type: "veg",
  },
  {
    name: "Veggie Smash Burger",
    description: "Double smashed veggie patty with cheddar, pickles, and our signature secret sauce.",
    price: 219,
    image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=500",
    category: "Burger",
    isAvailable: true,
    isFeatured: true,
    type: "veg",
  },
  {
    name: "Spinach & Cheese Burger",
    description: "Wholesome spinach and cottage cheese patty with roasted peppers and chipotle sauce.",
    price: 169,
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500",
    category: "Burger",
    isAvailable: true,
    isFeatured: false,
    type: "veg",
  },

  // ── PIZZAS (7 veg) ────────────────────────────────────────────────────────
  {
    name: "Margherita Classic",
    description: "Simple and timeless — fresh mozzarella, san marzano tomatoes, and basil on a crispy thin crust.",
    price: 299,
    image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500",
    category: "Pizza",
    isAvailable: true,
    isFeatured: true,
    type: "veg",
  },
  {
    name: "Veggie Supreme",
    description: "Fresh capsicum, black olives, mushrooms, red onions, and sweet corn on a rich tomato base.",
    price: 349,
    image: "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=500",
    category: "Pizza",
    isAvailable: true,
    isFeatured: true,
    type: "veg",
  },
  {
    name: "Paneer Makhani Pizza",
    description: "Creamy makhani sauce base topped with paneer cubes, onions, and capsicum with mozzarella.",
    price: 399,
    image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500",
    category: "Pizza",
    isAvailable: true,
    isFeatured: true,
    type: "veg",
  },
  {
    name: "Mexican Fiesta Pizza",
    description: "Salsa base with kidney beans, jalapeños, corn, onions, and a chipotle drizzle.",
    price: 379,
    image: "https://images.unsplash.com/photo-1594007654729-407eedc4be65?w=500",
    category: "Pizza",
    isAvailable: true,
    isFeatured: false,
    type: "veg",
  },
  {
    name: "Four Cheese Pizza",
    description: "Mozzarella, cheddar, parmesan, and gouda on a white garlic base — cheese heaven.",
    price: 449,
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500",
    category: "Pizza",
    isAvailable: true,
    isFeatured: true,
    type: "veg",
  },
  {
    name: "Pesto Mushroom Pizza",
    description: "Basil pesto base with sautéed mushrooms, sun-dried tomatoes, and fresh mozzarella.",
    price: 419,
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1000",
    category: "Pizza",
    isAvailable: true,
    isFeatured: false,
    type: "veg",
  },
  {
    name: "Spicy Tandoori Veg Pizza",
    description: "Tandoori spiced sauce with paneer, onions, capsicum, and a mint chutney drizzle.",
    price: 389,
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500",
    category: "Pizza",
    isAvailable: false,
    isFeatured: false,
    type: "veg",
  },

  // ── FRIES (5 veg) ─────────────────────────────────────────────────────────
  {
    name: "Classic Salted Fries",
    description: "Thin cut, perfectly seasoned golden fries. Simple, crispy, and addictive.",
    price: 89,
    image: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=500",
    category: "Fries",
    isAvailable: true,
    isFeatured: false,
    type: "veg",
  },
  {
    name: "Loaded Cheese Fries",
    description: "Crispy golden fries smothered in warm cheddar sauce and sprinkled with chilli flakes.",
    price: 139,
    image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500",
    category: "Fries",
    isAvailable: true,
    isFeatured: true,
    type: "veg",
  },
  {
    name: "Peri Peri Fries",
    description: "Crispy fries tossed in our house peri peri spice blend with a squeeze of lime.",
    price: 119,
    image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=500",
    category: "Fries",
    isAvailable: true,
    isFeatured: true,
    type: "veg",
  },
  {
    name: "Garlic Parmesan Fries",
    description: "Golden fries tossed in garlic butter and topped with freshly grated parmesan cheese.",
    price: 159,
    image: "https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=500",
    category: "Fries",
    isAvailable: true,
    isFeatured: false,
    type: "veg",
  },
  {
    name: "Masala Fries",
    description: "Indian-spiced fries tossed with chaat masala, red chilli, and a dash of lemon.",
    price: 109,
    image: "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=500",
    category: "Fries",
    isAvailable: true,
    isFeatured: false,
    type: "veg",
  },

  // ── MOMOS (6 veg) ─────────────────────────────────────────────────────────
  {
    name: "Steamed Veg Momos",
    description: "Classic soft steamed dumplings stuffed with spiced cabbage, carrots, and spring onions.",
    price: 99,
    image: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500",
    category: "Momos",
    isAvailable: true,
    isFeatured: false,
    type: "veg",
  },
  {
    name: "Paneer Momos",
    description: "Soft momos stuffed with spiced paneer and herbs, served with tangy red chutney.",
    price: 129,
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500",
    category: "Momos",
    isAvailable: true,
    isFeatured: true,
    type: "veg",
  },
  {
    name: "Fried Veg Momos",
    description: "Crispy golden fried momos with a vegetable filling, served with schezwan dip.",
    price: 119,
    image: "https://images.unsplash.com/photo-1626776876729-bab4369a5a5a?w=1000",
    category: "Momos",
    isAvailable: true,
    isFeatured: true,
    type: "veg",
  },
  {
    name: "Tandoori Paneer Momos",
    description: "Paneer-filled momos tossed in smoky tandoori marinade and grilled to perfection.",
    price: 149,
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500",
    category: "Momos",
    isAvailable: true,
    isFeatured: true,
    type: "veg",
  },
  {
    name: "Corn & Cheese Momos",
    description: "Sweet corn and melted cheese stuffed dumplings with a creamy white sauce dip.",
    price: 139,
    image: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500",
    category: "Momos",
    isAvailable: true,
    isFeatured: false,
    type: "veg",
  },
  {
    name: "Chocolate Momos",
    description: "Dessert momos filled with rich dark chocolate and served with vanilla dipping sauce.",
    price: 159,
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500",
    category: "Momos",
    isAvailable: true,
    isFeatured: true,
    type: "veg",
  },

  // ── COLD DRINKS (6 veg) ───────────────────────────────────────────────────
  {
    name: "Mango Slush",
    description: "Ice cold alphonso mango slush with a hint of chilli salt on the rim.",
    price: 79,
    image: "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=500",
    category: "Cold Drinks",
    isAvailable: true,
    isFeatured: true,
    type: "veg",
  },
  {
    name: "Oreo Milkshake",
    description: "Thick blended Oreo milkshake topped with whipped cream and crushed cookie crumbs.",
    price: 179,
    image: "https://images.unsplash.com/photo-1577805947697-89e18249d767?w=500",
    category: "Cold Drinks",
    isAvailable: true,
    isFeatured: true,
    type: "veg",
  },
  {
    name: "Watermelon Mojito",
    description: "Refreshing fresh watermelon cooler blended with mint, lime, and soda.",
    price: 129,
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500",
    category: "Cold Drinks",
    isAvailable: true,
    isFeatured: false,
    type: "veg",
  },
  {
    name: "Cold Coffee Frappe",
    description: "Creamy cold coffee blended with vanilla ice cream and finished with chocolate drizzle.",
    price: 149,
    image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500",
    category: "Cold Drinks",
    isAvailable: true,
    isFeatured: false,
    type: "veg",
  },
  {
    name: "Blue Lagoon Mocktail",
    description: "Chilled citrus mocktail with blue curacao flavour, lemon, and soda.",
    price: 159,
    image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500",
    category: "Cold Drinks",
    isAvailable: true,
    isFeatured: true,
    type: "veg",
  },
  {
    name: "Strawberry Lemonade",
    description: "Fresh strawberries blended with tangy lemonade and topped with mint leaves.",
    price: 139,
    image: "https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=500",
    category: "Cold Drinks",
    isAvailable: true,
    isFeatured: false,
    type: "veg",
  },

  // ── NON-VEG BURGERS (3) ───────────────────────────────────────────────────
  {
    name: "Classic Smash Burger",
    description: "Double smashed beef patty with cheddar, lettuce, tomato, pickles, and our secret sauce.",
    price: 199,
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500",
    category: "Burger",
    isAvailable: true,
    isFeatured: true,
    type: "non-veg",
  },
  {
    name: "Spicy Chicken Burger",
    description: "Crispy fried chicken thigh with jalapeños, coleslaw, and sriracha mayo in a toasted bun.",
    price: 179,
    image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=500",
    category: "Burger",
    isAvailable: true,
    isFeatured: true,
    type: "non-veg",
  },
  {
    name: "BBQ Bacon Burger",
    description: "Juicy beef patty stacked with crispy bacon, smoky BBQ sauce, and caramelised onions.",
    price: 329,
    image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=500",
    category: "Burger",
    isAvailable: true,
    isFeatured: false,
    type: "non-veg",
  },

  // ── NON-VEG PIZZAS (2) ────────────────────────────────────────────────────
  {
    name: "BBQ Chicken Pizza",
    description: "Smoky BBQ sauce base with grilled chicken chunks, red onions, and mozzarella.",
    price: 349,
    image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500",
    category: "Pizza",
    isAvailable: true,
    isFeatured: true,
    type: "non-veg",
  },
  {
    name: "Pepperoni Blast Pizza",
    description: "Classic pepperoni pizza with extra mozzarella, oregano seasoning, and chilli flakes.",
    price: 449,
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1000",
    category: "Pizza",
    isAvailable: true,
    isFeatured: true,
    type: "non-veg",
  },

  // ── NON-VEG MOMOS (3) ────────────────────────────────────────────────────
  {
    name: "Tandoori Chicken Momos",
    description: "Smoky tandoori marinated chicken momos served with mint chutney and onion rings.",
    price: 149,
    image: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500",
    category: "Momos",
    isAvailable: true,
    isFeatured: true,
    type: "non-veg",
  },
  {
    name: "Crispy Chicken Momos",
    description: "Golden fried chicken momos served with spicy schezwan dipping sauce.",
    price: 179,
    image: "https://images.unsplash.com/photo-1626776876729-bab4369a5a5a?w=1000",
    category: "Momos",
    isAvailable: true,
    isFeatured: false,
    type: "non-veg",
  },
  {
    name: "Dragon Chicken Momos",
    description: "Juicy chicken momos tossed in a fiery dragon sauce with spring onions.",
    price: 209,
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500",
    category: "Momos",
    isAvailable: true,
    isFeatured: true,
    type: "non-veg",
  },

  // ── NON-VEG FRIES (2) ─────────────────────────────────────────────────────
  {
    name: "Chicken Loaded Fries",
    description: "Crispy fries loaded with spicy grilled chicken chunks, cheese sauce, and jalapeños.",
    price: 279,
    image: "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=500",
    category: "Fries",
    isAvailable: true,
    isFeatured: true,
    type: "non-veg",
  },
  {
    name: "Keema Fries",
    description: "Golden fries topped with spiced minced chicken keema, onions, and coriander.",
    price: 249,
    image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=500",
    category: "Fries",
    isAvailable: true,
    isFeatured: false,
    type: "non-veg",
  },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB...");

    await Product.deleteMany({});
    console.log("Cleared existing products...");

    await Product.insertMany(products);
    console.log(`Seeded ${products.length} products successfully!`);

    await mongoose.disconnect();
    console.log("Done! Disconnected from MongoDB.");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

seed();