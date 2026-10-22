// Key for matching item texts: "  Tej " and "tej" are the same suggestion.
// Used by the server (unique key in item_suggestions) and the client (search, hiding items already on the list).
export function normalizeItemText(text: string) {
  return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('hu')
}
