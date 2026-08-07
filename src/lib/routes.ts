/**
 * Application route definitions for the hand-rolled router.
 *
 * NOTE: "/" is deliberately NOT an application route. The marketing/landing
 * page is a static HTML file served by Vercel at the root; the React app only
 * handles the operational routes below. See vercel.json for the mapping.
 */

export type Route =
  | '/login'
  | '/signup'
  | '/privacy'
  | '/terms'
  | '/how-to'
  | '/dashboard'
  | '/privacy-request'
  | '/contact';

export const PUBLIC_ROUTES: Route[] = ['/signup', '/privacy', '/terms', '/how-to', '/privacy-request', '/contact'];
export const AUTH_ROUTES: Route[] = ['/login'];
export const PROTECTED_ROUTES: Route[] = ['/dashboard'];

export function isRoute(path: string): path is Route {
  return (
    path === '/login' ||
    path === '/signup' ||
    path === '/privacy' ||
    path === '/terms' ||
    path === '/how-to' ||
    path === '/dashboard' ||
    path === '/privacy-request' ||
    path === '/contact'
  );
}
