// login.js

/**
 * ====================================================================
 * 【セキュリティ学習用：Web Crypto API 実装版】
 * --------------------------------------------------------------------
 * パスワードを平文ではなく、ブラウザ標準の "Web Crypto API" を使用して
 * SHA-256でハッシュ化してから照合するように改良しました。
 * これにより、万が一localStorageが漏洩しても、パスワードの原形は守られます。
 * ====================================================================
 */

// ハッシュ化関数 (signup.jsと同じアルゴリズムを使用)
async function hashPassword(text) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

document.getElementById("loginForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const userName = document.getElementById("userName").value.trim();
  const password = document.getElementById("password").value;

  // 1. 入力されたパスワードをハッシュ化する
  const hashedPassword = await hashPassword(password);

  // 2. ユーザーデータの取得
  const users = JSON.parse(localStorage.getItem("users")) || [];

  // 3. 認証ロジック (ハッシュ値同士を比較)
  const found = users.find(u => u.userName === userName && u.password === hashedPassword);

  if (!found) {
    alert("ユーザー名またはパスワードが不正です");
    return;
  }

  // 4. ログイン成功処理
  // セッション情報の保存（パスワードは含めないのがベストプラクティスだが、今回は簡易的にオブジェクトごと保存）
  localStorage.setItem("currentUser", JSON.stringify(found));

  console.log("Login successful using SHA-256 hash.");
  window.location.href = "index.html";
});