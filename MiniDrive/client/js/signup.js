// signup.js

// =========================================================
// ユーティリティ: SHA-256 ハッシュ化関数
// =========================================================
async function hashPassword(text) {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ユーザーデータ取得
function loadUsers() {
    const data = localStorage.getItem("users");
    return data ? JSON.parse(data) : [];
}

// ユーザーデータ保存
function saveUsers(users) {
    localStorage.setItem("users", JSON.stringify(users));
}

// ===============================
// フォーム送信イベント
// ===============================
// async を追加（ハッシュ化の待ち合わせのため）
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

    // ★ここでハッシュ化を実行
    const hashedPassword = await hashPassword(password);

    // 新規ユーザー登録（ハッシュ値を保存）
    users.push({
        userName: userName,
        password: hashedPassword, // 平文ではなくハッシュ値を保存
        createdAt: new Date().toISOString()
    });

    saveUsers(users);

    console.log("登録されたハッシュ値:", hashedPassword); // デバッグ用
    alert("登録が完了しました！ログインしてください。");
    window.location.href = "login.html";
});