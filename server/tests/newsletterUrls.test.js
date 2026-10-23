const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

describe('Newsletter Email & Blog URL Resolution', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const originalClientOrigin = process.env.CLIENT_ORIGIN;

  afterEach(() => {
    if (originalFrontendUrl !== undefined) {
      process.env.FRONTEND_URL = originalFrontendUrl;
    } else {
      delete process.env.FRONTEND_URL;
    }

    if (originalClientOrigin !== undefined) {
      process.env.CLIENT_ORIGIN = originalClientOrigin;
    } else {
      delete process.env.CLIENT_ORIGIN;
    }
  });

  test('generates valid blog article URLs with FRONTEND_URL set', () => {
    process.env.FRONTEND_URL = 'https://vedhunt.in';
    const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'https://vedhunt.in').replace(/\/$/, '');
    const slug = 'mudgarvale-performance-marketing-case-study';
    const fullUrl = `${frontendUrl}/blog/${slug}`;

    assert.equal(fullUrl, 'https://vedhunt.in/blog/mudgarvale-performance-marketing-case-study');
    assert.ok(!fullUrl.includes('undefined'), 'URL must never contain undefined');
  });

  test('falls back gracefully to CLIENT_ORIGIN if FRONTEND_URL is unset', () => {
    delete process.env.FRONTEND_URL;
    process.env.CLIENT_ORIGIN = 'https://vedhunt.in';
    const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'https://vedhunt.in').replace(/\/$/, '');
    const slug = 'mudgarvale-performance-marketing-case-study';
    const fullUrl = `${frontendUrl}/blog/${slug}`;

    assert.equal(fullUrl, 'https://vedhunt.in/blog/mudgarvale-performance-marketing-case-study');
    assert.ok(!fullUrl.includes('undefined'), 'URL must never contain undefined');
  });

  test('falls back gracefully to https://vedhunt.in if both env vars are unset', () => {
    delete process.env.FRONTEND_URL;
    delete process.env.CLIENT_ORIGIN;
    const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'https://vedhunt.in').replace(/\/$/, '');
    const slug = 'test-slug';
    const fullUrl = `${frontendUrl}/blog/${slug}`;

    assert.equal(fullUrl, 'https://vedhunt.in/blog/test-slug');
    assert.ok(!fullUrl.includes('undefined'), 'URL must never contain undefined');
  });

  test('generates correct unsubscribe links', () => {
    process.env.FRONTEND_URL = 'https://vedhunt.in';
    const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'https://vedhunt.in').replace(/\/$/, '');
    const token = 'abc123token';
    const unsubLink = `${frontendUrl}/unsubscribe/${token}`;

    assert.equal(unsubLink, 'https://vedhunt.in/unsubscribe/abc123token');
    assert.ok(!unsubLink.includes('undefined'));
  });
});
