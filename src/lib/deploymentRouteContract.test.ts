/**
 * QUALITY-001 — Regression contract tests for the static-landing / portal
 * route split.
 *
 * The app deliberately has two execution surfaces:
 *   /          → static marketing landing page (public/landing.html)
 *   /login     → Vite/React application (index.html)
 *   /dashboard → Vite/React application (index.html)
 *
 * These tests are pure file/route-contract tests (no browser automation) that
 * fail if the boundary is accidentally re-merged (e.g. a global SPA catch-all
 * rewrite is restored, the landing page starts mounting React, or the
 * corrected metadata regresses).
 */

import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUTH_ROUTES, PROTECTED_ROUTES, PUBLIC_ROUTES, isRoute } from './routes';

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

function repoFileExists(relativePath: string) {
  return existsSync(new URL(`../../${relativePath}`, import.meta.url));
}

const vercelJson = JSON.parse(readRepoFile('vercel.json')) as {
  rewrites: { source: string; destination: string }[];
};
const landing = readRepoFile('public/landing.html');
const portalEntry = readRepoFile('index.html');
const notFoundPage = readRepoFile('public/404.html');
const linkSource = readRepoFile('src/components/common/Link.tsx');

// The React application routes are the source of truth for the portal surface.
const APP_ROUTES = [...AUTH_ROUTES, ...PROTECTED_ROUTES, ...PUBLIC_ROUTES];

// Rewrite source patterns that would silently boot the React app for unknown
// URLs (the old global SPA catch-all and equivalent Vercel wildcard forms).
const SPA_CATCH_ALL_SOURCES = ['/(.*)', '/:path*', '/:path(.*)', '*'];

describe('vercel.json deployment route contract', () => {
  it('rewrites the static root "/" to the landing page', () => {
    const root = vercelJson.rewrites.find((r) => r.source === '/');
    expect(root?.destination).toBe('/landing.html');
  });

  it('rewrites every current React application route to the portal entry', () => {
    for (const route of APP_ROUTES) {
      const entry = vercelJson.rewrites.find((r) => r.source === route);
      expect(entry?.destination, `rewrite for ${route}`).toBe('/index.html');
    }
  });

  it('contains exactly the static root plus the current app routes (no invented routes)', () => {
    const sources = vercelJson.rewrites.map((r) => r.source).sort();
    const expected = ['/', ...APP_ROUTES].sort();
    expect(sources).toEqual(expected);
  });

  it('has no SPA catch-all rewrite (unknown URLs must stay a real 404)', () => {
    for (const rewrite of vercelJson.rewrites) {
      expect(SPA_CATCH_ALL_SOURCES, `catch-all source: ${rewrite.source}`).not.toContain(rewrite.source);
      // All contract sources are exact literal paths — no wildcard tokens.
      expect(rewrite.source).not.toMatch(/[()*:]/);
    }
  });

  it('leaves unknown paths unmatched so they cannot silently boot React', () => {
    const sources = new Set(vercelJson.rewrites.map((r) => r.source));
    const unknownPaths = ['/nope', '/admin', '/index.html', '/landing.html', '/foo/bar'];
    for (const path of unknownPaths) {
      expect(sources.has(path), `unknown path should not be rewritten: ${path}`).toBe(false);
    }
  });
});

describe('application route classification (src/lib/routes.ts)', () => {
  it('does NOT treat "/" as an application route (static landing lives outside the SPA)', () => {
    expect(isRoute('/')).toBe(false);
  });

  it('recognises /login and /dashboard', () => {
    expect(isRoute('/login')).toBe(true);
    expect(isRoute('/dashboard')).toBe(true);
  });

  it('recognises the public legal/contact/request-access app routes', () => {
    for (const route of ['/signup', '/privacy', '/terms', '/how-to', '/contact', '/privacy-request']) {
      expect(isRoute(route)).toBe(true);
    }
  });

  it('rejects arbitrary unknown paths', () => {
    for (const path of ['/foo', '/admin', '/index.html', '/landing.html', '/privacy-request/', '/LOGIN', '']) {
      expect(isRoute(path)).toBe(false);
    }
  });

  it('classifies /login as an auth route and /dashboard as a protected route', () => {
    expect(AUTH_ROUTES).toContain('/login');
    expect(PROTECTED_ROUTES).toContain('/dashboard');
  });

  it('keeps public legal/contact routes out of auth/protected categories', () => {
    for (const route of PUBLIC_ROUTES) {
      expect(AUTH_ROUTES).not.toContain(route);
      expect(PROTECTED_ROUTES).not.toContain(route);
    }
  });

  it('keeps the route categories aligned with the canonical application route set', () => {
    const all = [...AUTH_ROUTES, ...PROTECTED_ROUTES, ...PUBLIC_ROUTES];
    // Categories do not overlap.
    expect(new Set(all).size).toBe(all.length);
    // Every categorised route is a valid application route.
    for (const route of all) expect(isRoute(route)).toBe(true);
    // The categories together cover every application route — if a route is
    // added to isRoute without being classified, this test fails.
    const canonicalAppRoutes = [
      '/login',
      '/signup',
      '/privacy',
      '/terms',
      '/how-to',
      '/dashboard',
      '/privacy-request',
      '/contact',
    ];
    expect(new Set(all)).toEqual(new Set(canonicalAppRoutes));
  });
});

describe('static landing entry stays static (public/landing.html)', () => {
  it('does not mount the React application', () => {
    expect(landing).not.toContain('<div id="root">');
    expect(landing).not.toContain('/src/main.tsx');
  });

  it('links its own stylesheet and the current favicon', () => {
    expect(landing).toContain('href="/landing.css"');
    expect(landing).toContain('href="/favicon.svg"');
  });

  it('offers a Sign in link to the React login route', () => {
    expect(landing).toMatch(/href="\/login"[^>]*>\s*Sign in/);
  });

  it('offers a Request access link to the contact/request flow', () => {
    expect(landing).toMatch(/href="\/contact"[^>]*>\s*Request access/);
  });
});

describe('portal entry stays React (index.html)', () => {
  it('mounts the React application', () => {
    expect(portalEntry).toContain('<div id="root"></div>');
    expect(portalEntry).toContain('/src/main.tsx');
  });

  it('does not contain the marketing landing markup or its structured data', () => {
    expect(portalEntry).not.toContain('application/ld+json');
    expect(portalEntry).not.toContain('og:image');
    expect(portalEntry).not.toContain('/marketing/social/');
  });

  it('carries portal/auth-appropriate metadata', () => {
    expect(portalEntry).toMatch(/<title>[^<]*Fleet Portal[^<]*<\/title>/i);
  });
});

describe('landing metadata regression protection', () => {
  it('does not advertise a £0/free offer in structured data', () => {
    expect(landing).not.toContain('"price": "0"');
    expect(landing).not.toContain('"offers"');
    expect(landing).not.toContain('"@type": "Offer"');
  });

  it('does not repeat the unsupported "GDPR compliant" hero claim', () => {
    expect(landing).not.toContain('GDPR</strong><span>compliant');
  });

  it('does not reference the missing social preview image', () => {
    expect(landing).not.toContain('marketing/social/hourwise-og-card.png');
    expect(landing).not.toContain('/marketing/social/');
  });
});

describe('static asset contract', () => {
  const requiredAssets = [
    'public/landing.html',
    'public/landing.css',
    'public/landing.js',
    'public/404.html',
    'public/favicon.svg',
  ];

  it('keeps every core static landing asset present', () => {
    for (const asset of requiredAssets) {
      expect(repoFileExists(asset), asset).toBe(true);
    }
  });
});

describe('404 contract (public/404.html)', () => {
  it('links back to the static home and offers the login route', () => {
    expect(notFoundPage).toMatch(/href="\/"[^>]*>/);
    expect(notFoundPage).toContain('href="/login"');
  });

  it('is excluded from search indexes', () => {
    expect(notFoundPage).toMatch(/name="robots" content="[^"]*noindex/);
  });
});

describe('link navigation contract (src/components/common/Link.tsx)', () => {
  // Link.tsx navigates with the SPA router for application routes (isRoute
  // true) and performs a full page load for other "/" paths (isRoute false)
  // so the separate static landing page is fetched from the server.
  it('treats application routes as SPA-navigable links', () => {
    for (const route of ['/login', '/dashboard', '/privacy']) {
      expect(isRoute(route)).toBe(true);
    }
  });

  it('treats "/" as outside the SPA (full navigation to the static landing)', () => {
    expect(isRoute('/')).toBe(false);
  });

  it('still drives the app-vs-static decision from the route helper', () => {
    // Structural guard: if Link stops using isRoute / the full-load fallback,
    // the contract above would no longer describe the component's behaviour.
    expect(linkSource).toContain('isRoute');
    expect(linkSource).toContain('window.location.href');
  });
});
