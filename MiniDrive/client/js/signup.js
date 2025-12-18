// ===============================
// signup.js（ローカルストレージ版）
// ===============================

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
// フォーム送信
// ===============================
document.getElementById("signupForm").addEventListener("submit", (e) => {
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

    // ユーザー名の重複チェック
    if (users.some(u => u.userName === userName)) {
        alert("このユーザー名は使用されています");
        return;
    }

    // 新規ユーザー登録
    users.push({
        userName: userName,
        password: password
    });

    saveUsers(users);

    alert("登録が完了しました！ログインしてください。");
    window.location.href = "login.html";
});
