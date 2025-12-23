// js/login.js
import { hashPassword } from './auth.js'; // ★共通部品から読み込む

document.getElementById("loginForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const userName = document.getElementById("userName").value.trim();
  const password = document.getElementById("password").value;

  // 1. 入力されたパスワードをハッシュ化（非同期）
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
  localStorage.setItem("currentUser", JSON.stringify(found));

  console.log("Login successful.");
  window.location.href = "index.html";
});