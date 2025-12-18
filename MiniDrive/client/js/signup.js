// signup.js

/**
 * ====================================================================
 * 新規登録モジュール
 * --------------------------------------------------------------------
 * 概要:
 * ユーザー入力のバリデーションを行い、localStorageにデータを保存します。
 * * 【学習のポイント・現状の課題】
 * 1. データ整合性: 
 * 現在は `Array.some()` で重複チェックを行っていますが、同時アクセスがある環境では
 * 「レースコンディション」が発生するリスクがあります。
 * → 実務では、RDBの「Unique制約」を用いてDB側で整合性を担保すべきと理解しています。
 * 2. パスワード管理:
 * ログイン機能同様、平文保存はセキュリティリスクとなります。
 * ====================================================================
 */

// ユーザーデータ取得ヘルパー
// 将来的に API 通信に置き換えやすいよう関数化
function loadUsers() {
    const data = localStorage.getItem("users");
    return data ? JSON.parse(data) : [];
}

// ユーザーデータ保存ヘルパー
function saveUsers(users) {
    localStorage.setItem("users", JSON.stringify(users));
}

// ===============================
// フォーム送信イベント処理
// ===============================
document.getElementById("signupForm").addEventListener("submit", (e) => {
    e.preventDefault();

    // DOM要素の取得
    const userName = document.getElementById("userName").value.trim();
    const password = document.getElementById("password").value;
    const password2 = document.getElementById("password2").value;

    // 1. 基本バリデーション（必須入力）
    if (!userName || !password) {
        alert("ユーザー名とパスワードを入力してください");
        return;
    }

    // 2. パスワード一致確認
    // UX観点：リアルタイムでエラーを出す実装も検討の余地あり
    if (password !== password2) {
        alert("パスワードが一致しません");
        return;
    }

    let users = loadUsers();

    // 3. ユーザー名の重複チェック (Business Logic)
    // 配列操作で簡易的に実装。ユーザー数が増えるとパフォーマンス懸念あり。
    if (users.some(u => u.userName === userName)) {
        alert("このユーザー名は使用されています");
        return;
    }

    // 4. データ登録
    // NOTE: 本来ここでパスワードのハッシュ化(bcrypt等)を行う必要がある
    users.push({
        userName: userName,
        password: password,
        createdAt: new Date().toISOString() // 登録日時は監査ログ等で重要
    });

    saveUsers(users);

    alert("登録が完了しました！ログインしてください。");
    // ログイン画面へ遷移
    window.location.href = "login.html";
});