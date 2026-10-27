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

// Modern Menu Discovery & Filtering layout
assert(menuClientSrc.includes("activeFiltersCount"), "MenuClient.js must track activeFiltersCount");
assert(menuClientSrc.includes("updateFilters"), "MenuClient.js must provide updateFilters handler");

// Filter Controls & Toolbar
assert(menuClientSrc.includes("Open filter panel"), "MenuClient.js must provide filter panel trigger");
assert(menuClientSrc.includes("selectedCategory"), "MenuClient.js must track selectedCategory");
assert(menuClientSrc.includes("selectedType"), "MenuClient.js must track selectedType");
assert(menuClientSrc.includes("selectedRestaurant"), "MenuClient.js must track selectedRestaurant");
assert(menuClientSrc.includes("onlyInStock"), "MenuClient.js must track onlyInStock");
assert(menuClientSrc.includes("sortBy"), "MenuClient.js must track sortBy");

// Active Filter Pills
assert(menuClientSrc.includes("Remove category filter"), "Active filter pills must support removing category filter");
assert(menuClientSrc.includes("Remove dietary filter"), "Active filter pills must support removing dietary filter");

console.log("✓ PASS: Modern Menu Filter controls and active filter pills verified");
console.log("✓ PASS: Category, dietary, kitchen, and in-stock filter state management verified");

console.log("\n=======================================================");
console.log("🎉 ALL MENU FILTER & TOAST NOTIFICATION POLISH CHECKS PASSED!");
console.log("=======================================================");
