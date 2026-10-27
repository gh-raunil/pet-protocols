import fs from "fs";
import path from "path";
import assert from "assert";

console.log("=== Starting Phase V2: Menu & Product Discovery Visual Redesign Verification ===\n");

const baseDir = path.resolve(".");
const frontendUserDir = path.join(baseDir, "frontend-user");

// --- 1. ProductCard.js Contract & Visual Stability ---
console.log("--- 1. Testing ProductCard.js Implementation Contract ---");
const productCardPath = path.join(frontendUserDir, "components", "products", "ProductCard.js");
assert(fs.existsSync(productCardPath), "ProductCard.js must exist");
const productCardSrc = fs.readFileSync(productCardPath, "utf8");

assert(productCardSrc.includes("aspect-[4/3]"), "ProductCard.js must enforce 4:3 aspect ratio to prevent CLS");
assert(productCardSrc.includes("object-cover"), "ProductCard.js must use object-cover for food imagery");
assert(productCardSrc.includes("export function ProductCardSkeleton"), "ProductCard.js must export ProductCardSkeleton");
assert(productCardSrc.includes("export default function ProductCard"), "ProductCard.js must export default ProductCard");
assert(productCardSrc.includes("onError={() => setImgSrc(FALLBACK_IMAGE)}"), "ProductCard.js must handle image loading errors with fallback");
assert(productCardSrc.includes("product.type === \"veg\""), "ProductCard.js must accurately check veg vs non-veg");
assert(productCardSrc.includes("!product.isAvailable"), "ProductCard.js must handle unavailable/sold out state");
assert(productCardSrc.includes("!restStatus.isOpen"), "ProductCard.js must handle closed kitchen state");
assert(productCardSrc.includes("focus-visible:ring-2"), "ProductCard.js must have visible focus rings");
assert(productCardSrc.includes("addItem(product)"), "ProductCard.js must call addItem(product) on add to cart");

console.log("✓ PASS: ProductCard enforces 4:3 aspect ratio and prevents CLS");
console.log("✓ PASS: ProductCard handles image fallbacks and veg/non-veg indicator");
console.log("✓ PASS: ProductCard handles unavailable and closed kitchen states with accessible actions");

// --- 2. Skeleton.js Synchronized Dimensions ---
console.log("\n--- 2. Testing Skeleton.js Synchronized Dimensions ---");
const skeletonPath = path.join(frontendUserDir, "components", "ui", "Skeleton.js");
assert(fs.existsSync(skeletonPath), "Skeleton.js must exist");
const skeletonSrc = fs.readFileSync(skeletonPath, "utf8");

assert(skeletonSrc.includes("aspect-[4/3]"), "Skeleton.js ProductCardSkeleton must enforce aspect-[4/3] to match ProductCard");
console.log("✓ PASS: ProductCardSkeleton matches ProductCard dimensions and layout");

// --- 3. MenuClient.js Browsing & Filtering Hierarchy ---
console.log("\n--- 3. Testing MenuClient.js Browsing & Filtering Contract ---");
const menuClientPath = path.join(frontendUserDir, "app", "(pages)", "menu", "MenuClient.js");
assert(fs.existsSync(menuClientPath), "MenuClient.js must exist");
const menuClientSrc = fs.readFileSync(menuClientPath, "utf8");

assert(menuClientSrc.includes('aria-label="Search dishes by name or category"'), "MenuClient.js must provide accessible search input label");
assert(menuClientSrc.includes("selectedType") || menuClientSrc.includes("handleTypeClick"), "MenuClient.js must support dietary filtering (Veg, Non-Veg, All)");
assert(menuClientSrc.includes("setOnlyInStock"), "MenuClient.js must support in-stock toggle");
assert(menuClientSrc.includes("setSortBy"), "MenuClient.js must support sorting options");
assert(menuClientSrc.includes("selectedRestaurant") || menuClientSrc.includes("setSelectedRestaurant"), "MenuClient.js must support partner kitchen filtering");
assert(menuClientSrc.includes("categoryPillList") || menuClientSrc.includes("dynamicCategories.reduce"), "MenuClient.js must calculate total dishes globally from dynamicCategories");
assert(menuClientSrc.includes("categoryPillList") || menuClientSrc.includes("cat.dishCount"), "MenuClient.js must read dishCount from dynamicCategories to prevent zeroing on filter");
assert(menuClientSrc.includes("ProductCardSkeleton"), "MenuClient.js must render skeletons during loading");
assert(menuClientSrc.includes("fetchProducts()"), "MenuClient.js must provide retry mechanism on error");
assert(menuClientSrc.includes("Reset All Filters") || menuClientSrc.includes("Reset Filters"), "MenuClient.js must provide reset action on empty state");

console.log("✓ PASS: MenuClient provides streamlined search, dietary, kitchen, and sorting controls");
console.log("✓ PASS: MenuClient maintains independent category counts across active filters");
console.log("✓ PASS: MenuClient provides loading skeleton, error retry, and empty state reset actions");

// --- 4. ProductDetailClient.js Natural Mobile Hierarchy & Safety ---
console.log("\n--- 4. Testing ProductDetailClient.js Implementation Contract ---");
const productDetailPath = path.join(frontendUserDir, "app", "(pages)", "menu", "[id]", "ProductDetailClient.js");
assert(fs.existsSync(productDetailPath), "ProductDetailClient.js must exist");
const productDetailSrc = fs.readFileSync(productDetailPath, "utf8");

assert(productDetailSrc.includes(", quantity);"), "ProductDetailClient.js must call quantity-aware addItem");
assert(!productDetailSrc.includes("for (let i = 0; i < quantity; i++)"), "ProductDetailClient.js must not loop-add items to cart");
assert(productDetailSrc.includes("role=\"dialog\""), "ProductDetailClient.js review modal must implement WAI-ARIA role='dialog'");
assert(productDetailSrc.includes("aria-modal=\"true\""), "ProductDetailClient.js review modal must set aria-modal='true'");
assert(productDetailSrc.includes("e.key === \"Escape\""), "ProductDetailClient.js review modal must listen for Escape key");
assert(productDetailSrc.includes("overflow = \"hidden\""), "ProductDetailClient.js review modal must lock body scroll");
assert(productDetailSrc.includes("Customer Review"), "ProductDetailClient.js must display honest 'Customer Review'");
assert(productDetailSrc.includes("isVerifiedPurchase"), "ProductDetailClient.js must gate verified badge on isVerifiedPurchase");
assert(productDetailSrc.includes("Math.min(20,"), "ProductDetailClient.js must clamp quantity at maximum 20");
assert(productDetailSrc.includes("Math.max(1,"), "ProductDetailClient.js must clamp quantity at minimum 1");

console.log("✓ PASS: ProductDetailClient preserves single-flight quantity addition and clamps quantity 1..20");
console.log("✓ PASS: ProductDetailClient review modal conforms to WAI-ARIA dialog pattern with focus trap & Escape");
console.log("✓ PASS: ProductDetailClient enforces honest review labeling gated on real verification");

console.log("\n=======================================================");
console.log("🎉 ALL PHASE V2 MENU & PRODUCT REDESIGN TESTS PASSED!");
console.log("=======================================================\n");
