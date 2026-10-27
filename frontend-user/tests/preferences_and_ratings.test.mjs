import test from 'node:test';
import assert from 'node:assert/strict';
import { getBestSellingProducts, getTopRatedProducts } from '../lib/userPreferences.js';

test('Frontend User Preferences & Rating Sorting Integrity', async (t) => {
  await t.test('1. Unrated products do not receive fabricated rating (4.5) or reviews (10)', () => {
    const unratedDish = { _id: '1', name: 'Plain Fries', rating: null, numRatings: 0, isFeatured: false };
    const ratedDish = { _id: '2', name: 'Loaded Pizza', rating: 4.2, numRatings: 3, isFeatured: false };

    const topRated = getTopRatedProducts([unratedDish, ratedDish]);
    assert.equal(topRated[0]._id, '2', 'Dish with authentic rating 4.2 must rank higher than unrated dish');
    assert.equal(topRated[1]._id, '1', 'Unrated dish must rank lower, not be treated as 4.5');
  });

  await t.test('2. getBestSellingProducts treats missing rating/numRatings as 0', () => {
    const unratedDish = { _id: '1', name: 'Unrated Dish', rating: null, numRatings: 0, isFeatured: false };
    const ratedDish = { _id: '2', name: 'Rated Dish', rating: 3.5, numRatings: 1, isFeatured: false };

    const bestSellers = getBestSellingProducts([unratedDish, ratedDish]);
    assert.equal(bestSellers[0]._id, '2', 'Rated dish with 3.5 score should rank above unrated 0 score');
  });

  await t.test('3. Featured products are prioritized honestly by the isFeatured flag', () => {
    const featuredDish = { _id: '1', name: 'Chef Special', isFeatured: true, rating: null, numRatings: 0 };
    const normalDish = { _id: '2', name: 'Normal Dish', isFeatured: false, rating: null, numRatings: 0 };

    const bestSellers = getBestSellingProducts([normalDish, featuredDish]);
    assert.equal(bestSellers[0]._id, '1', 'Featured product is boosted by isFeatured flag');
  });
});
