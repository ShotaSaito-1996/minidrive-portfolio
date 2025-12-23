// js/signup.js
import { hashPassword } from './auth.js'; // ★共通部品から読み込む

// ユーザーデータ取得ヘルパー
function loadUsers() {
    const data = localStorage.getItem("users");
    return data ? JSON.parse(data) : [];
}

// ユーザーデータ保存ヘルパー
function saveUsers(users) {
    localStorage.setItem("users", JSON.stringify(users));
}

// フォーム送信イベント
document.getElementById("signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const userName = document.getElementById("userName").value.trim();
    const password = document.getElementById("password").value;
    const password2 = document.getElementById("password2").value;

    if (!userName || !password) {
        alert("ユーザー名とパスワードを入力してください");
        return;
    }

    if (password !== password2) {
        alert("パスワードが一致しません");
        return;
    }

    let users = loadUsers();

    if (users.some(u => u.userName === userName)) {
        alert("このユーザー名は使用されています");
        return;
    }

    // ★ハッシュ化を実行
    const hashedPassword = await hashPassword(password);

    // 新規ユーザー登録
    users.push({
        userName: userName,
        password: hashedPassword,
        createdAt: new Date().toISOString()
    });

    saveUsers(users);

    alert("登録が完了しました！ログインしてください。");
    window.location.href = "login.html";
});