const test = require('node:test');
const assert = require('node:assert');
const { MediaModel } = require('../db.js');

test('MediaModel - Initial Database State', () => {
  const stats = MediaModel.getStats();
  assert.ok(stats.total >= 580, 'Database should contain imported records');
  assert.ok(stats.categories.length >= 3, 'Should have Anime, Movie, and Hentai categories');
});

test('MediaModel - Create, Query, and Delete Lifecycle', () => {
  const testTitle = 'Automated Test Media ' + Date.now();
  
  // 1. Create
  const created = MediaModel.create({
    name: testTitle,
    alt_name: 'テスト自動化',
    category: 'Anime',
    type: 'Movie',
    seasons: 2,
    year: '2026',
    watched: [true, false],
    rating: 8.5,
    notes: 'Lifecycle test note'
  });

  assert.ok(created.id, 'Created record must have an ID');
  assert.strictEqual(created.name, testTitle);
  assert.strictEqual(created.status, 'Watching');
  assert.strictEqual(created.watched.length, 2);
  assert.strictEqual(created.watched[0], true);
  assert.strictEqual(created.watched[1], false);

  // 2. Query by ID
  const retrieved = MediaModel.getById(created.id);
  assert.ok(retrieved, 'Should retrieve created item');
  assert.strictEqual(retrieved.rating, 8.5);

  // 3. Duplicate Detection
  const dup = MediaModel.findDuplicate(testTitle, 'Anime');
  assert.ok(dup, 'Should detect exact duplicate');
  assert.strictEqual(dup.id, created.id);

  // 4. Update Watched
  const updatedWatched = MediaModel.updateWatched(created.id, [true, true]);
  assert.strictEqual(updatedWatched.status, 'Completed', 'Status should automatically change to Completed');

  // 5. Toggle Season
  const toggled = MediaModel.toggleSeason(created.id, 1);
  assert.strictEqual(toggled.watched[1], false);
  assert.strictEqual(toggled.status, 'Watching');

  // 6. Delete
  const deleted = MediaModel.delete(created.id);
  assert.strictEqual(deleted, true);

  const missing = MediaModel.getById(created.id);
  assert.strictEqual(missing, null, 'Deleted record should no longer exist');
});

test('MediaModel - Search and Pagination', () => {
  const page1 = MediaModel.getAll({ page: 1, limit: 10 });
  assert.strictEqual(page1.items.length, 10);
  assert.strictEqual(page1.page, 1);
  assert.ok(page1.total >= 580);

  // Search
  const mulanSearch = MediaModel.getAll({ search: 'Mulan' });
  assert.ok(mulanSearch.total >= 1, 'Search for Mulan should return results');
  assert.ok(mulanSearch.items.some(i => i.name.toLowerCase().includes('mulan')));
});

test('MediaModel - Lucky Wheel Candidates', () => {
  const wheelPool = MediaModel.getWheelCandidates('All', 'All');
  assert.ok(Array.isArray(wheelPool));
  assert.ok(wheelPool.length > 0);
  assert.ok(wheelPool.every(i => i.status !== 'Completed'), 'Lucky wheel should only include unwatched media');
});
