// Run with: node --import ./client/src/employee/lib/test-setup.mjs --test client/src/employee/lib/pagination.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_SIZES, pageWindow } from './pagination.js';

describe('pagination page strip', () => {
  test('few pages are all listed', () => {
    assert.deepEqual(pageWindow(1, 1), [1]);
    assert.deepEqual(pageWindow(3, 5), [1, 2, 3, 4, 5]);
    assert.deepEqual(pageWindow(4, 7), [1, 2, 3, 4, 5, 6, 7]);
  });

  test('near the start: first pages, a gap, then the last page', () => {
    assert.deepEqual(pageWindow(1, 20), [1, 2, 3, 4, '…', 20]);
    assert.deepEqual(pageWindow(3, 20), [1, 2, 3, 4, '…', 20]);
  });

  test('in the middle: first, gap, around the current page, gap, last', () => {
    assert.deepEqual(pageWindow(10, 20), [1, '…', 9, 10, 11, '…', 20]);
  });

  test('near the end: first page, a gap, then the last pages', () => {
    assert.deepEqual(pageWindow(20, 20), [1, '…', 17, 18, 19, 20]);
    assert.deepEqual(pageWindow(18, 20), [1, '…', 17, 18, 19, 20]);
  });

  test('a one-page gap is shown as the page itself, not an ellipsis', () => {
    assert.deepEqual(pageWindow(5, 9), [1, '…', 4, 5, 6, '…', 9]);
    assert.deepEqual(pageWindow(4, 9), [1, 2, 3, 4, 5, '…', 9]);
  });

  test('the current page is always present and the strip never repeats a page', () => {
    for (let total = 1; total <= 30; total++) {
      for (let page = 1; page <= total; page++) {
        const strip = pageWindow(page, total).filter((p) => p !== '…');
        assert.ok(strip.includes(page), `${page}/${total}`);
        assert.equal(new Set(strip).size, strip.length, `${page}/${total}`);
        assert.ok(strip.includes(1) && strip.includes(total));
      }
    }
  });

  test('page sizes start at 10 so short lists show no pager', () => {
    assert.equal(PAGE_SIZES[0], 10);
    assert.ok(PAGE_SIZES.includes(20));
  });
});
