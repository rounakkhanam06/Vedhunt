// Categories are stored in uppercase; display them in title case.
export const formatCategory = (category = '') =>
  category
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
