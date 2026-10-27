import { chromium } from "playwright";

async function checkLogin() {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });

  const page = await browser.newPage();
  console.log("Navigating to http://localhost:3001/login...");
  await page.goto("http://localhost:3001/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  console.log("Filling form...");
  await page.locator('form input[type="email"]').first().fill("admin@flagship.com");
  await page.locator('form input[type="password"]').first().fill("rounak");
  await page.locator('button[type="submit"]:has-text("Sign In to Kitchen")').click();
  await page.waitForTimeout(4000);

  console.log("Admin Final URL:", page.url());
  const adminErrors = await page.locator(".text-red-600, .text-red-400, .bg-red-500").allInnerTexts();
  console.log("Admin Errors on page:", adminErrors);

  console.log("\nNavigating to http://localhost:3002/login...");
  await page.goto("http://localhost:3002/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.fill('input[name="email"]', "superadmin.petprotocols@gmail.com");
  await page.fill('input[name="password"]', "rounak");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  console.log("Superadmin Final URL:", page.url());
  const superErrors = await page.locator(".text-red-600, .text-red-400, .bg-red-500").allInnerTexts();
  console.log("Superadmin Errors on page:", superErrors);

  await browser.close();
}

checkLogin();
