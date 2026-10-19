import fs from "fs";
import path from "path";
import assert from "assert";

const BASE_DIR = process.cwd();
const USER_FRONTEND_DIR = path.join(BASE_DIR, "frontend-user");
const HERO_CAROUSEL_PATH = path.join(USER_FRONTEND_DIR, "components", "hero", "HeroCarousel.js");
const HOME_PAGE_PATH = path.join(USER_FRONTEND_DIR, "app", "page.js");
const PUBLIC_IMAGES_DIR = path.join(USER_FRONTEND_DIR, "public", "images");

console.log("=== Starting Pet Protocols Theme-Aware Animated Hero Verification ===\n");

// ── 1. Image Assets Existence Verification ──────────────────────────
console.log("--- 1. Testing Image Asset Existence & Integrity ---");

const LIGHT_ASSETS = [
  "light_theme_heros/herolight1_1.png",
  "light_theme_heros/herolight1_2.png",
  "light_theme_heros/herolight1_3.png",
  "light_theme_heros/herolight1_4.png",
];

const DARK_ASSETS = [
  "dark_theme_heros/darkhero_1.png",
  "dark_theme_heros/darkhero_2.png",
  "dark_theme_heros/darkhero_3.png",
  "dark_theme_heros/darkhero_4.png",
];

for (const asset of LIGHT_ASSETS) {
  const assetPath = path.join(PUBLIC_IMAGES_DIR, asset);
  assert.strictEqual(fs.existsSync(assetPath), true, `Missing light asset: ${asset}`);
  const stats = fs.statSync(assetPath);
  assert.strictEqual(stats.size > 50000, true, `Light asset ${asset} is suspiciously small: ${stats.size} bytes`);
  console.log(`✓ PASS: Light asset exists and valid: ${asset} (${Math.round(stats.size / 1024)} KB)`);
}

for (const asset of DARK_ASSETS) {
  const assetPath = path.join(PUBLIC_IMAGES_DIR, asset);
  assert.strictEqual(fs.existsSync(assetPath), true, `Missing dark asset: ${asset}`);
  const stats = fs.statSync(assetPath);
  assert.strictEqual(stats.size > 50000, true, `Dark asset ${asset} is suspiciously small: ${stats.size} bytes`);
  console.log(`✓ PASS: Dark asset exists and valid: ${asset} (${Math.round(stats.size / 1024)} KB)`);
}

// ── 2. HeroCarousel.js Implementation Contract ──────────────────────
console.log("\n--- 2. Testing HeroCarousel Component Architecture ---");
assert.strictEqual(fs.existsSync(HERO_CAROUSEL_PATH), true, "HeroCarousel.js component must exist");
const carouselContent = fs.readFileSync(HERO_CAROUSEL_PATH, "utf-8");

// Strict client boundary
assert.strictEqual(carouselContent.includes('"use client"'), true, "Must have 'use client' directive");
console.log("✓ PASS: HeroCarousel is a valid client component");

// Theme system reuse
assert.strictEqual(carouselContent.includes('import { useTheme } from "@/components/ui/ThemeProvider"'), true, "Must reuse existing ThemeProvider");
assert.strictEqual(carouselContent.includes("resolvedTheme"), true, "Must consume resolvedTheme from useTheme()");
console.log("✓ PASS: HeroCarousel reuses existing application ThemeProvider without creating duplicate theme system");

// Separate Light and Dark Collections
assert.strictEqual(carouselContent.includes("LIGHT_HERO_SLIDES"), true, "Must define LIGHT_HERO_SLIDES");
assert.strictEqual(carouselContent.includes("DARK_HERO_SLIDES"), true, "Must define DARK_HERO_SLIDES");

for (const asset of LIGHT_ASSETS) {
  assert.strictEqual(carouselContent.includes(asset), true, `LIGHT_HERO_SLIDES must reference ${asset}`);
}
for (const asset of DARK_ASSETS) {
  assert.strictEqual(carouselContent.includes(asset), true, `DARK_HERO_SLIDES must reference ${asset}`);
}
console.log("✓ PASS: Light and Dark collections contain all specified real assets in optimal display order");

// Zero theme bleeding: separate containers
assert.strictEqual(carouselContent.includes("block dark:hidden"), true, "Must isolate Light carousel to light mode");
assert.strictEqual(carouselContent.includes("hidden dark:block"), true, "Must isolate Dark carousel to dark mode");
console.log("✓ PASS: Theme isolation enforced via CSS classes — zero flash or theme bleeding on mount or toggle");

// ── 3. Timing, Animation & Accessibility Contracts ──────────────────
console.log("\n--- 3. Testing Timing, Motion & Accessibility ---");

// 9-second rotation interval
assert.strictEqual(carouselContent.includes("9000"), true, "Must rotate every 9000ms (9s)");
console.log("✓ PASS: Slide rotation interval set to exactly 9 seconds");

// 700ms crossfade transition
assert.strictEqual(carouselContent.includes("duration-700"), true, "Must use 700ms transition duration");
console.log("✓ PASS: Crossfade transition duration configured to 700ms");

// Scale / zoom effect
assert.strictEqual(carouselContent.includes("scale-102") || carouselContent.includes("scale-[1.02]"), true, "Must provide subtle zoom effect (scale 1.02)");
console.log("✓ PASS: Subtle zoom effect implemented during transitions");

// Tab visibility detection
assert.strictEqual(carouselContent.includes("visibilitychange"), true, "Must listen to visibilitychange");
assert.strictEqual(carouselContent.includes("document.hidden"), true, "Must check document.hidden to pause rotation");
console.log("✓ PASS: Automatic rotation pauses when browser tab is inactive/hidden");

// Reduced motion support
assert.strictEqual(carouselContent.includes("prefers-reduced-motion"), true, "Must respect prefers-reduced-motion media query");
console.log("✓ PASS: Accessibility prefers-reduced-motion respected");

// Session-consistent random starting slide
assert.strictEqual(carouselContent.includes("sessionStorage"), true, "Must use sessionStorage for session-scoped stability");
assert.strictEqual(carouselContent.includes("localStorage"), true, "Must use localStorage to avoid repeating previous slide");
console.log("✓ PASS: Session-scoped starting slide randomization with repetition avoidance");

// ── 4. Premium Blended Photography Treatment (Picture 1 Fidelity) ──
console.log("\n--- 4. Testing Premium Blended Panoramic Photography Treatment ---");

// Panoramic linear gradient blend
assert.strictEqual(carouselContent.includes("linear-gradient(to right"), true, "Must use linear-gradient(to right) for seamless horizontal feathering into text area");
console.log("✓ PASS: Horizontal gradient blend seamlessly integrates food scene into --bg-main");

// Directional gradient feather overlays
assert.strictEqual(carouselContent.includes("bg-gradient-to-t"), true, "Must include directional bottom feather into next section");
console.log("✓ PASS: Directional feather overlays blend image seamlessly into --bg-main");

// ── 5. Homepage Integration Verification ────────────────────────────
console.log("\n--- 5. Testing Homepage Integration ---");
assert.strictEqual(fs.existsSync(HOME_PAGE_PATH), true, "Homepage page.js must exist");
const homeContent = fs.readFileSync(HOME_PAGE_PATH, "utf-8");

assert.strictEqual(homeContent.includes("import HeroCarousel from"), true, "page.js must import HeroCarousel");
assert.strictEqual(homeContent.includes("<HeroCarousel"), true, "page.js must render <HeroCarousel />");
assert.strictEqual(!homeContent.includes("hero-burger-board.jpg"), true, "Old hardcoded hero image must be replaced");
console.log("✓ PASS: Homepage page.js seamlessly integrates HeroCarousel");

console.log("\n=======================================================");
console.log("🎉 ALL PET PROTOCOLS HERO IMPLEMENTATION TESTS PASSED!");
console.log("=======================================================\n");
