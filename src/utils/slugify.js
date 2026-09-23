const slugify = (text = "") =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove non-word chars
    .replace(/[\s_-]+/g, "-") // collapse spaces/underscores to single dash
    .replace(/^-+|-+$/g, ""); // trim leading/trailing dashes

export default slugify;

// Human-readable, sortable order number, e.g. ORD-LX3F9A2K
export const generateOrderNumber = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${stamp}${rand}`;
};
