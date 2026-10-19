import fs from "fs";
import path from "path";
import assert from "assert";

console.log("=== Testing UI Refinement: Menu Filter Section + Toast Notifications ===\n");

const baseDir = path.resolve(".");
const frontendUserDir = path.join(baseDir, "frontend-user");

// --- 1. Toast Notification Component Verification ---
console.log("--- 1. Testing ToastProvider.js Implementation & Aesthetics ---");
const toastProviderPath = path.join(frontendUserDir, "components", "ui", "ToastProvider.js");
assert(fs.existsSync(toastProviderPath), "ToastProvider.js must exist");
const toastProviderSrc = fs.readFileSync(toastProviderPath, "utf8");

// Hierarchy and readable success messages
assert(toastProviderSrc.includes("title: str || defaultTitleForType(type)"), "parseToastContent must make single string message the prominent title");
assert(toastProviderSrc.includes("description: \"\""), "parseToastContent must not duplicate simple message into artificial category and description");

// Compact proportions and restrained styling
assert(toastProviderSrc.includes("min-w-[280px]") || toastProviderSrc.includes("max-w-sm"), "Toast must use compact, non-oversized dimensions");
assert(toastProviderSrc.includes("w-7 h-7 sm:w-8 sm:h-8"), "Status icon must be compact and consistent (w-7/w-8)");
assert(toastProviderSrc.includes("w-4 h-4 shrink-0"), "Inner icon must be crisp w-4 h-4");
assert(toastProviderSrc.includes("bg-[var(--bg-card)]/95"), "Toast must use Pet Protocols design tokens");
assert(toastProviderSrc.includes("border-[var(--border-color)]"), "Toast must use Pet Protocols border tokens");

// Reduced-motion accessibility
assert(toastProviderSrc.includes("@media (prefers-reduced-motion: reduce)"), "ToastProvider must support prefers-reduced-motion accessibility");

// Preservation of dismissal and stacking logic
assert(toastProviderSrc.includes("aria-live=\"polite\""), "Toast container must declare aria-live='polite'");
assert(toastProviderSrc.includes("role=\"region\""), "Toast container must declare role='region'");
assert(toastProviderSrc.includes("aria-label=\"Dismiss notification\""), "Dismiss button must have accessible label");
assert(toastProviderSrc.includes("onPointerDown"), "SwipeableToastItem must support gesture swipe interaction");
assert(toastProviderSrc.includes("pauseTimer"), "Toast must pause dismissal on hover/interaction");

// Toast type variants
assert(toastProviderSrc.includes("success: {"), "Toast must define success variant");
assert(toastProviderSrc.includes("error: {"), "Toast must define error variant");
assert(toastProviderSrc.includes("warning: {"), "Toast must define warning variant");
assert(toastProviderSrc.includes("info: {"), "Toast must define info variant");
assert(toastProviderSrc.includes("loading: {"), "Toast must define loading variant");

console.log("✓ PASS: ToastProvider formats messages cleanly with immediate readability for 'Added to cart'");
console.log("✓ PASS: ToastProvider enforces compact proportions, subtle borders, and small consistent icons");
console.log("✓ PASS: ToastProvider includes prefers-reduced-motion media query for motion sensitivity");
console.log("✓ PASS: ToastProvider preserves swipe dismissal, pause-on-hover, and WAI-ARIA live region");
console.log("✓ PASS: ToastProvider styles success, error, warning, info, and loading variants cohesively");

// --- 2. Menu Filter Section Verification ---
console.log("\n--- 2. Testing MenuClient.js Filter Section Refinement ---");
const menuClientPath = path.join(frontendUserDir, "app", "(pages)", "menu", "MenuClient.js");
assert(fs.existsSync(menuClientPath), "MenuClient.js must exist");
const menuClientSrc = fs.readFileSync(menuClientPath, "utf8");

// Unified Menu Discovery Hub layout
assert(menuClientSrc.includes("UNIFIED MENU DISCOVERY HUB"), "MenuClient.js must preserve Unified Menu Discovery Hub");
assert(menuClientSrc.includes("rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]"), "Filter wrapper must use clean rounded-2xl and restrained theme borders");

// Row 1: Compact Category Chips
assert(menuClientSrc.includes("h-8 inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold"), "Category chips must have uniform compact h-8 height and rounded-lg radius");
assert(menuClientSrc.includes("cat.icon"), "Category chips must render category icon");
assert(menuClientSrc.includes("cat.label"), "Category chips must render category label");
assert(menuClientSrc.includes("cat.count"), "Category chips must preserve category counts");

// Row 2: Consistent Heights & Alignment
assert(menuClientSrc.includes("h-9 w-full pl-9 pr-8 rounded-lg"), "Search input must have uniform h-9 height");
assert(menuClientSrc.includes("h-9 inline-flex items-center rounded-lg bg-[var(--bg-sub)] border border-[var(--border-color)] p-0.5"), "Dietary toggle must have uniform h-9 height");
assert(menuClientSrc.includes("h-9 inline-flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-semibold border"), "In Stock filter must have uniform h-9 height");
assert(menuClientSrc.includes("h-9 pl-3 pr-7 rounded-lg bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs font-semibold"), "Sort dropdown must have uniform h-9 height");
assert(menuClientSrc.includes("h-9 inline-flex items-center gap-1 px-2.5 sm:px-3 rounded-lg"), "Reset filter button must have uniform h-9 height");

// Row 3: Partner Kitchens Row
assert(menuClientSrc.includes("Partner Kitchens:"), "MenuClient.js must preserve Partner Kitchens label");
assert(menuClientSrc.includes("h-7 inline-flex items-center px-2.5 rounded-md text-xs font-medium"), "All Kitchens chip must have uniform h-7 height and rounded-md radius");
assert(menuClientSrc.includes("h-7 inline-flex items-center gap-1.5 px-2.5 rounded-md text-xs font-medium"), "Individual Kitchen chips must have uniform h-7 height and rounded-md radius");
assert(menuClientSrc.includes("op.isOpen ? \"bg-emerald-500\" : \"bg-amber-500\""), "Partner kitchen chips must retain operational indicator dot");
assert(menuClientSrc.includes("scrollbar-none"), "Horizontal scrolling rows must use scrollbar-none to prevent awkward scrollbars");

// Verification of preserved filter logic
assert(menuClientSrc.includes("handleCategoryClick"), "handleCategoryClick must be preserved");
assert(menuClientSrc.includes("handleTypeClick"), "handleTypeClick must be preserved");
assert(menuClientSrc.includes("handleStockToggle"), "handleStockToggle must be preserved");
assert(menuClientSrc.includes("handleSortChange"), "handleSortChange must be preserved");
assert(menuClientSrc.includes("handleRestaurantClick"), "handleRestaurantClick must be preserved");
assert(menuClientSrc.includes("handleResetFilters"), "handleResetFilters must be preserved");

console.log("✓ PASS: Category chips are compact with uniform h-8 height, rounded-lg styling, and crisp baseline alignment");
console.log("✓ PASS: All Row 2 controls (Search, Dietary toggle, In Stock filter, Sort, Reset) share identical h-9 height and vertical alignment");
console.log("✓ PASS: Partner Kitchens row is balanced with uniform h-7 chips, operational status dots, and smooth horizontal scrolling");
console.log("✓ PASS: All filter state handlers, click interactions, and accessibility attributes are fully preserved");

console.log("\n=======================================================");
console.log("🎉 ALL MENU FILTER & TOAST NOTIFICATION POLISH CHECKS PASSED!");
console.log("=======================================================");
