// Pinned page header for the admin overview pages: from laptop width (lg) up it
// sits right under the 64px admin top bar (top-16) while the page scrolls, with
// a solid background so cards slide underneath it. On phones the filter panels
// wrap into many rows, so it scrolls normally there instead of covering the
// screen. The negative margins + matching padding stretch it over the
// surrounding p-4 / sm:p-6 gutter so nothing peeks out at the sides.
// Requires no ancestor with overflow hidden/auto (AdminLayout uses overflow-x-clip).
export const STICKY_HEADER =
  'lg:sticky lg:top-16 z-30 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 pb-4 space-y-4 bg-app-bg/95 backdrop-blur-md border-b border-app-border';
