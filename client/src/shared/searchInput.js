// Search boxes must not treat spaces as search characters.
//
// cleanSearchInput — use in a search box's onChange. The box can't start with a
// space and can't hold two spaces in a row, but a single space between words
// still works ("Amit Choudhary"). A trailing space is allowed while typing,
// because the next word hasn't been typed yet.
//
// searchTerm — use wherever the value is applied (filtering a list or sending
// it to the API): trims it, so "amit " searches exactly like "amit", and a
// box holding only spaces counts as empty. The server also trims ?search= / ?q=
// (server/middleware/cleanSearchQuery.js), so API searches are safe either way.
export const cleanSearchInput = (value) => String(value ?? '').replace(/^\s+/, '').replace(/\s{2,}/g, ' ');

export const searchTerm = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
