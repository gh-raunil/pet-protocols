import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import connectDB from "../lib/db.js";
import Restaurant from "../models/Restaurant.js";
import Feedback from "../models/Feedback.js";

test("Restaurant Rating and Review Data Integrity Suite", async (t) => {
  await connectDB();

  await t.test("1. Schema defaults: New restaurant has null rating and 0 numRatings", () => {
    const tempRest = new Restaurant({
      name: "Temporary Test Kitchen " + Date.now(),
      slug: "temp-test-kitchen-" + Date.now(),
      address: { street: "123 Test St", city: "Bengaluru", state: "KA", zipCode: "560001" },
    });

    assert.equal(tempRest.rating, null, "Unrated restaurant default rating must be null, not 4.8");
    assert.equal(tempRest.numRatings, 0, "Unrated restaurant default numRatings must be 0, not 28");
  });

  await t.test("2. Database state: Unrated restaurants sanitized, authentic feedback preserved", async () => {
    const burgerKitchen = await Restaurant.findOne({ slug: "burger-and-co" });
    assert(burgerKitchen, "Burger & Co. Kitchen must exist in DB");
    assert.equal(burgerKitchen.rating, 5, "Burger & Co. Kitchen must have authentic rating of 5");
    assert.equal(burgerKitchen.numRatings, 1, "Burger & Co. Kitchen must have 1 authentic review");

    const shivamBhog = await Restaurant.findOne({ slug: "shivam-bhog" });
    assert(shivamBhog, "Shivam Bhog must exist in DB");
    assert.equal(shivamBhog.rating, null, "Shivam Bhog (0 reviews) must have rating=null");
    assert.equal(shivamBhog.numRatings, 0, "Shivam Bhog (0 reviews) must have numRatings=0");
  });

  await t.test("3. Endpoint GET /api/ratings?targetType=restaurant returns authentic or null", async () => {
    const shivamBhog = await Restaurant.findOne({ slug: "shivam-bhog" });
    const resUnrated = await fetch(
      `http://127.0.0.1:4000/api/ratings?targetType=restaurant&targetId=${shivamBhog._id}`
    );
    assert.equal(resUnrated.status, 200);
    const dataUnrated = await resUnrated.json();
    assert.equal(dataUnrated.success, true);
    assert.equal(dataUnrated.rating, null, "Unrated restaurant must return rating: null");
    assert.equal(dataUnrated.numRatings, 0, "Unrated restaurant must return numRatings: 0");

    const burgerKitchen = await Restaurant.findOne({ slug: "burger-and-co" });
    const resRated = await fetch(
      `http://127.0.0.1:4000/api/ratings?targetType=restaurant&targetId=${burgerKitchen._id}`
    );
    assert.equal(resRated.status, 200);
    const dataRated = await resRated.json();
    assert.equal(dataRated.success, true);
    assert.equal(dataRated.rating, 5, "Authentic restaurant must return rating: 5");
    assert.equal(dataRated.numRatings, 1, "Authentic restaurant must return numRatings: 1");
  });

  await t.test("4. Endpoint GET /api/restaurants public listing reflects authentic values", async () => {
    const res = await fetch("http://127.0.0.1:4000/api/restaurants");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert(Array.isArray(data.restaurants), "restaurants must be an array");

    const shivam = data.restaurants.find((r) => r.slug === "shivam-bhog");
    assert(shivam, "Shivam Bhog should be in active restaurant listing");
    assert.equal(shivam.rating, null, "Shivam Bhog must have rating=null in public API");
    assert.equal(shivam.numRatings, 0, "Shivam Bhog must have numRatings=0 in public API");

    const burger = data.restaurants.find((r) => r.slug === "burger-and-co");
    assert(burger, "Burger & Co. Kitchen should be in active restaurant listing");
    assert.equal(burger.rating, 5, "Burger & Co. Kitchen must have rating=5 in public API");
    assert.equal(burger.numRatings, 1, "Burger & Co. Kitchen must have numRatings=1 in public API");
  });

  await t.test("5. Endpoint POST /api/ratings calculates new rating from authentic zero baseline", async () => {
    // Create temporary test restaurant
    const testRest = await Restaurant.create({
      name: "Temporary Rating Calculation Test " + Date.now(),
      slug: "temp-calc-test-" + Date.now(),
      status: "archived",
      rating: null,
      numRatings: 0,
      address: { street: "Test", city: "Test", state: "KA", zipCode: "560001" },
    });

    try {
      // First rating: 4 stars
      const res1 = await fetch("http://127.0.0.1:4000/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "restaurant",
          targetId: testRest._id.toString(),
          rating: 4,
          userName: "Test Diner",
        }),
      });
      assert.equal(res1.status, 200);
      const data1 = await res1.json();
      assert.equal(data1.rating, 4, "First rating on unrated restaurant must be exactly 4.0, not skewed by legacy 4.8");
      assert.equal(data1.numRatings, 1, "Review count must be 1");

      // Second rating: 5 stars -> (4 + 5) / 2 = 4.5
      const res2 = await fetch("http://127.0.0.1:4000/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "restaurant",
          targetId: testRest._id.toString(),
          rating: 5,
          userName: "Test Diner 2",
        }),
      });
      assert.equal(res2.status, 200);
      const data2 = await res2.json();
      assert.equal(data2.rating, 4.5, "Average rating of [4, 5] must be exactly 4.5");
      assert.equal(data2.numRatings, 2, "Review count must be 2");
    } finally {
      await Restaurant.deleteOne({ _id: testRest._id });
    }
  });

  await mongoose.disconnect();
});
