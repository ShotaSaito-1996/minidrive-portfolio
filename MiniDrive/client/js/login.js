// login.js

/**
 * ====================================================================
 * 【重要：セキュリティとアーキテクチャに関する学習メモ】
 * --------------------------------------------------------------------
 * 現在の実装：
 * クライアントサイドのみで動作させるため、localStorageを簡易DBとして使用し、
 * パスワードを「平文（そのまま）」で比較・保存しています。
 * * 学習用としての妥協点ですが、実務/本番環境では以下の重大なリスクがあります：
 * 1. XSS（クロスサイトスクリプティング）攻撃を受けた際、localStorageの中身が盗まれる。
 * 2. パスワードが暗号化されていないため、データ漏洩時にアカウントが乗っ取られる。
 * * ★本来あるべき実装（実務での想定）：
 * 1. パスワードはクライアント側で扱わず、HTTPSでサーバーへ送信する。
 * 2. サーバー側でソルト付きハッシュ化（bcrypt/Argon2等）を行ってDB保存する。
 * 3. 認証後はJWTやセッションIDを発行し、HttpOnly Cookieで管理する。
 * ====================================================================
 */

document.getElementById("loginForm").addEventListener("submit", function(e) {
  // フォームのデフォルト送信（ページリロード）をキャンセル
  e.preventDefault();

  // 入力値の取得
  const userName = document.getElementById("userName").value.trim();
  const password = document.getElementById("password").value;

  // 1. ユーザーデータの取得
  // LocalStorageから全ユーザー情報を取得（サーバーへの問い合わせの代用）
  const users = JSON.parse(localStorage.getItem("users")) || [];

  // 2. 認証ロジック
  // 配列操作メソッド find() を使用して、ID/Passが一致するユーザーを検索
  // TODO: 本番環境ではこの処理はサーバーサイドAPI内で行うべき
  const found = users.find(u => u.userName === userName && u.password === password);

  // 3. 認証結果の判定
  if (!found) {
    alert("ユーザー名またはパスワードが不正です");
    return;
  }

  // 4. セッション確立（簡易実装）
  // ログイン状態を保持するために currentUser を保存
  // ※セキュリティリスク: XSS脆弱性があるため、本来は避けるべき実装
  localStorage.setItem("currentUser", JSON.stringify(found));

  // 5. リダイレクト
  console.log("Login successful: Redirecting to dashboard...");
  window.location.href = "index.html";
});