// login.js

document.getElementById("loginForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const userName = document.getElementById("userName").value.trim();
  const password = document.getElementById("password").value;

  // 保存されているユーザー一覧を取得
  const users = JSON.parse(localStorage.getItem("users")) || [];

  // 一致するユーザーを探す
  const found = users.find(u => u.userName === userName && u.password === password);

  if (!found) {
    alert("ユーザー名またはパスワードが不正です");
    return;
  }

  // ログイン成功 → currentUser に保存
  localStorage.setItem("currentUser", JSON.stringify(found));

  // index.html へ移動
  window.location.href = "index.html";
});
