// ハッシュ化関数 (signup.jsと同じアルゴリズムを使用)
export async function hashPassword(text) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 現在ログインしているユーザー情報を取得
 * @returns {Object|null} ユーザーオブジェクト、または null
 */
export function getCurrentUser() {
  const json = localStorage.getItem("currentUser");
  return json ? JSON.parse(json) : null;
}