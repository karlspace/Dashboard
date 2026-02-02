// Slugify function to create anchor-friendly IDs from names
// Converts to lowercase and replaces spaces with hyphens
export default function slugify(name) {
  return name.toString().replace(/\s+/g, "-").toLowerCase();
}
