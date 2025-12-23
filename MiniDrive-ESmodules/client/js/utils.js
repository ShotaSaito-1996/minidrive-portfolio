/**
 * バイト数を人間が読みやすい形式に変換 (KB単位)
 * @param {number} bytes 
 * @returns {string} e.g., "15 KB"
 */
export function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  return Math.round(bytes / 1024) + " KB";
}