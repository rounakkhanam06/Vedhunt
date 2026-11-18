// Search boxes must not treat spaces as search characters: " amit ", "amit"
// and "amit  " are the same search, and a search of only spaces is no search.
// Runs once for every API request, so each controller/service that reads
// req.query.search / req.query.q gets the cleaned value.
//
// Express 5 exposes req.query as a getter that re-parses the URL on every
// access, so mutating it is lost — we shadow it with a plain own property.
const SEARCH_KEYS = ['search', 'q'];

function cleanSearchValue(value) {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/\s+/g, ' ');
}

function cleanSearchQuery(req, _res, next) {
  const query = req.query;
  if (!query || !SEARCH_KEYS.some((k) => k in query)) return next();

  const cleaned = { ...query };
  for (const key of SEARCH_KEYS) {
    if (!(key in cleaned)) continue;
    const value = cleanSearchValue(cleaned[key]);
    if (value === '') delete cleaned[key]; // only spaces → no search at all
    else cleaned[key] = value;
  }
  Object.defineProperty(req, 'query', { value: cleaned, writable: true, configurable: true, enumerable: true });
  next();
}

module.exports = { cleanSearchQuery, cleanSearchValue };
