// app.js

/**
 * ====================================================================
 * MiniDrive Logic
 * --------------------------------------------------------------------
 * 概要:
 * クライアントサイドのみで完結するファイル管理アプリのロジック。
 * 外部サーバーを使わず、ブラウザ標準の "IndexedDB" を使用して
 * データを永続化することで、セキュアかつ高速な動作を目指しました。
 * * 主な技術要素:
 * 1. IndexedDB: 大容量バイナリデータ(Fileオブジェクト)の保存先として採用
 * 2. Promise/Async-Await: 非同期DB操作の可読性を高めるために使用
 * 3. JSZip: クライアントサイドでのZIP圧縮機能の実装
 * ====================================================================
 */

// ---------- グローバル変数 ----------
let db;                     // IndexedDB インスタンス
let uploadWorkspace = [];   // アップロード待機中のファイルリスト（Fileオブジェクト）
let downloadWorkspace = []; // ダウンロード選択中のファイルリスト（DBから取得したオブジェクト）

// ★追加: ログイン中のユーザー情報を取得
const currentUserJson = localStorage.getItem("currentUser");
const currentUser = currentUserJson ? JSON.parse(currentUserJson) : null;

if (!currentUser) {
  window.location.href = "login.html";
} else {
  // ログイン中なら、ユーザー名を画面に表示する（もし表示エリアがあれば）
  // const userObj = JSON.parse(currentUser);
  // document.getElementById("userNameDisplay").textContent = userObj.userName; 
}

// ---------- DOM 要素の取得 ----------
// モード切替スイッチとUI表示要素
const toggle = document.getElementById("modeToggle");
const mainTitle = document.getElementById("mainTitle");
const modeLabel = document.getElementById("modeLabel");

// エリア・コンテナ
const dropzone = document.getElementById("dropzone"); // DnDエリア
const uploadFileListEl = document.getElementById("uploadFileList"); // アップロード予定リスト(ul)
const downloadFileListEl = document.getElementById("downloadFileList"); // ダウンロード予定リスト(ul)
const downloadContainer = document.getElementById("downloadContainer"); // サーバー側ファイル表示エリア
const serverFileListEl = document.getElementById("serverFileList");     // サーバー側ファイルリスト(ul)
const emptyMessage = document.getElementById("emptyMessage"); // ファイルが無い時のメッセージ

// 操作ボタン・入力フォーム
const fileBtn = document.getElementById("fileBtn");
const folderBtn = document.getElementById("folderBtn");
const fileInput = document.getElementById("fileInput");
const folderInput = document.getElementById("folderInput");
const deleteAllBtn = document.getElementById("deleteAllBtn");
const exportBtn = document.getElementById("exportBtn"); // .zip出力ボタン
const uploadBtn = document.getElementById("uploadBtn"); // DB保存ボタン

// =========================================================
// 1. IndexedDB (擬似サーバー) 関連処理
// ---------------------------------------------------------
// NOTE: 本来はバックエンドAPIを叩く箇所ですが、
// ポートフォリオとして単体動作させるためブラウザDBを使用しています。
// =========================================================

// DB初期化プロセス
function openDatabase() {
  return new Promise((resolve, reject) => {
    // DB名: MiniDriveDB, バージョン: 1
    const request = indexedDB.open("MiniDriveDB", 1);

    // DB構造の定義（初回またはバージョンアップ時に実行）
    request.onupgradeneeded = function (e) {
      db = e.target.result;
      // 'files' ストアを作成。主キー(id)は自動採番(autoIncrement)
      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files", { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = function (e) {
      db = e.target.result;
      resolve();
    };

    request.onerror = function () {
      console.error("DB Error:", request.error);
      reject("IndexedDB の初期化に失敗しました。");
    };
  });
}

/**
 * ファイル保存処理 (アップロード)
 * @param {File} file - ユーザーが選択したFileオブジェクト
 * NOTE: Fileオブジェクト(Blob)をそのままIndexedDBに保存可能です。
 */
async function saveFileToDB(file) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    
    // DBに保存するオブジェクト構造
    const request = store.add({
      name: file.name,
      type: file.type,
      size: file.size,
      data: file, // バイナリデータ本体
      lastModified: file.lastModified,
      createdAt: new Date(),
      owner: currentUser.userName
    });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * 全ファイル読み込み (サーバーリスト表示用)
 * カーソル(Cursor)を使って全件走査します。
 */
// app.js 内の loadFilesFromDB を修正

async function loadFilesFromDB() {
  return new Promise((resolve) => {
    const tx = db.transaction("files", "readonly");
    const store = tx.objectStore("files");
    const result = [];
    const request = store.openCursor();

    request.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        // ★修正: データの所有者(owner)が、今のユーザーと一致するかチェック
        const fileData = cursor.value;
        
        // 所有者情報がない（昔のデータ）or 所有者が自分と一致する場合のみ追加
        if (!fileData.owner || fileData.owner === currentUser.userName) {
            result.push(fileData);
        }
        
        cursor.continue();
      } else {
        resolve(result);
      }
    };
  });
}

/**
 * ファイル個別取得
 * @param {number} id - ファイルのID
 */
async function getFileFromDB(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction("files", "readonly");
        const store = tx.objectStore("files");
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// =========================================================
// 2. UI 更新・描画 関連処理
// ---------------------------------------------------------
// 状態(アップロード/ダウンロードモード)に応じたDOM操作を集約
// =========================================================

// モード切替時の表示制御
// モード切替時の表示更新
async function updateUI() {
  const isUploadMode = toggle.checked;

  if (isUploadMode) {
    // --- アップロードモード ---
    mainTitle.textContent = "ファイルアップロード";
    modeLabel.textContent = "アップロード";
    
    fileBtn.style.display = "inline-block";
    folderBtn.style.display = "inline-block";
    uploadBtn.style.display = "inline-block";

    // ★修正: 完全に表示する
    dropzone.style.display = "block"; 
    dropzone.style.opacity = "1";
    
    downloadContainer.style.display = "none";
    exportBtn.style.display = "none";

  } else {
    // --- ダウンロードモード ---
    mainTitle.textContent = "ファイルダウンロード";
    modeLabel.textContent = "ダウンロード";

    fileBtn.style.display = "none";
    folderBtn.style.display = "none";
    uploadBtn.style.display = "none";

    // ★修正: 完全に消す（非表示にする）
    dropzone.style.display = "none"; 

    downloadContainer.style.display = "block";
    exportBtn.style.display = "inline-block";

    await renderServerFileList();
  }

  renderWorkspace();
}

// =========================================================
// 追加実装: DBからの削除処理
// =========================================================

// ファイル削除関数 (ID指定)
// ※これがないと「deleteFileFromDB is not defined」エラーになります
async function deleteFileFromDB(id) {
  return new Promise((resolve, reject) => {
    // 読み書き権限(readwrite)でトランザクションを開始
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    
    // 削除リクエストを実行
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// =========================================================
// サーバーファイルリスト（DBの中身）の描画
// =========================================================
async function renderServerFileList() {
  const files = await loadFilesFromDB();
  serverFileListEl.innerHTML = "";

  // ファイルがない場合のメッセージ表示切り替え
  if (files.length === 0) {
    emptyMessage.classList.remove("hidden");
    emptyMessage.style.display = "block";
  } else {
    emptyMessage.classList.add("hidden");
    emptyMessage.style.display = "none";
  }

  files.forEach((f) => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";
    li.style.padding = "10px";
    li.style.borderBottom = "1px solid #eee";

    // --- 左側：ファイル名 ---
    const infoSpan = document.createElement("span");
    infoSpan.textContent = `${f.name} (${formatSize(f.size)})`;
    
    // レイアウト崩れ防止（名前が長すぎる場合の対策）
    infoSpan.style.overflow = "hidden";
    infoSpan.style.textOverflow = "ellipsis";
    infoSpan.style.whiteSpace = "nowrap";
    infoSpan.style.marginRight = "10px";

    // --- 右側：ボタンエリア ---
    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.gap = "5px"; 
    btnGroup.style.flexShrink = "0"; // ファイル名に押されてボタンが潰れないようにする

    // [＋追加] ボタン
    const addBtn = document.createElement("button");
    addBtn.textContent = "＋追加";
    addBtn.style.cursor = "pointer";
    addBtn.style.padding = "8px 20px";
    addBtn.style.lineHeight = "1";
    addBtn.style.height = "auto";
    addBtn.style.whiteSpace = "nowrap";
    
    addBtn.addEventListener("click", () => addToDownloadWorkspace(f));

    // [削除] ボタン
    const delBtn = document.createElement("button");
    delBtn.textContent = "削除";
    delBtn.style.backgroundColor = "#ff4444"; 
    delBtn.style.color = "white";
    delBtn.style.border = "none";
    delBtn.style.borderRadius = "4px";
    delBtn.style.padding = "8px 20px";
    delBtn.style.cursor = "pointer";
    delBtn.style.lineHeight = "1";
    delBtn.style.height = "auto";
    delBtn.style.whiteSpace = "nowrap";

    delBtn.addEventListener("click", async () => {
      // 確認ダイアログ
      if(confirm(`「${f.name}」を完全に削除しますか？`)) {
        try {
          // ここで上の deleteFileFromDB 関数を呼び出す
          await deleteFileFromDB(f.id);
          // 削除後にリストを再描画して反映させる
          await renderServerFileList();
        } catch (err) {
          console.error("削除エラー:", err);
          alert("削除に失敗しました");
        }
      }
    });

    // 並び順：[＋追加] [削除]
    btnGroup.appendChild(addBtn);
    btnGroup.appendChild(delBtn);

    li.appendChild(infoSpan);
    li.appendChild(btnGroup);
    serverFileListEl.appendChild(li);
  });
}


// リストアイテム(li要素)生成ヘルパー関数
// 重複コードを避けるため共通化
function createListItem(name, size, index, type) {
  const li = document.createElement("li");
  
  // テンプレートリテラルでHTML構造を定義
  li.innerHTML = `
    <span>${name} (${formatSize(size)})</span>
    <button class="del-btn" style="padding:2px 6px;">削除</button>
  `;

  // 削除ボタンのイベントハンドラ登録
  li.querySelector(".del-btn").addEventListener("click", () => {
    // 配列から該当インデックスを削除して再描画
    if (type === "upload") {
      uploadWorkspace.splice(index, 1);
    } else {
      downloadWorkspace.splice(index, 1);
    }
    renderWorkspace();
  });

  return li;
}

/**
 * バイト数を人間が読みやすい形式に変換 (KB単位)
 * @param {number} bytes 
 * @returns {string} e.g., "15 KB"
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  return Math.round(bytes / 1024) + " KB";
}


// =========================================================
// 3. イベントリスナー (ユーザー操作)
// ---------------------------------------------------------
// =========================================================

// --- アプリケーション初期化 ---
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await openDatabase(); // DB接続待機
    await updateUI();     // UI初期化
  } catch (e) {
    console.error(e);
    alert("初期化エラーが発生しました。ブラウザのバージョンを確認してください。");
  }
});

// --- モード切替トグル ---
toggle.addEventListener("change", () => {
  // UX考慮: モード切替時に作業中のリストをクリアして混乱を防ぐ
  uploadWorkspace = [];
  downloadWorkspace = [];
  updateUI();
});

// --- ファイル選択ボタン連携 ---
// 見た目のボタン(Btn)クリックで、隠しinput(Input)を発火させる
fileBtn.addEventListener("click", () => fileInput.click());
folderBtn.addEventListener("click", () => folderInput.click());

fileInput.addEventListener("change", (e) => {
  // FileList(類似配列)を純粋な配列に変換して処理
  const files = Array.from(e.target.files);
  addFilesToUploadWorkspace(files);
  fileInput.value = ""; // 同じファイルを再度選択できるようにリセット
});

folderInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  addFilesToUploadWorkspace(files);
  folderInput.value = "";
});

function addFilesToUploadWorkspace(files) {
  // TODO: ここで同名ファイルの重複チェック処理を追加する余地あり
  uploadWorkspace = uploadWorkspace.concat(files);
  renderWorkspace();
}

// --- ドラッグ＆ドロップ (DnD) ---
// dragover: カーソルが乗っている間、視覚的フィードバックを与える
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault(); // ブラウザ標準の「ファイルを開く」動作をキャンセル
  if (toggle.checked) {
    dropzone.style.backgroundColor = "#e0f7fa";
    dropzone.style.border = "2px dashed #00bcd4";
  }
});

// dragleave: カーソルが離れたら元に戻す
dropzone.addEventListener("dragleave", (e) => {
  e.preventDefault();
  resetDropzoneStyle();
});

// drop: ファイル受け取り
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  resetDropzoneStyle();

  // ダウンロードモード中の誤操作防止
  if (!toggle.checked) {
    alert("現在はダウンロードモードです。ファイルをアップロードするにはモードを切り替えてください。");
    return;
  }

  const files = Array.from(e.dataTransfer.files);
  if (files.length > 0) {
    addFilesToUploadWorkspace(files);
  }
});

function resetDropzoneStyle() {
  dropzone.style.backgroundColor = "";
  dropzone.style.border = "";
}


// --- サーバーファイルリストからの追加 ---
function addToDownloadWorkspace(dbFile) {
  // 配列に追加して再描画
  downloadWorkspace.push(dbFile);
  renderWorkspace();
}


// --- 「アップロード」ボタン (DBへ保存実行) ---
uploadBtn.addEventListener("click", async () => {
  if (uploadWorkspace.length === 0) {
    alert("ファイルが選択されていません。");
    return;
  }

  const confirmMsg = `選択された ${uploadWorkspace.length} 件のファイルを保存しますか？`;
  if (!confirm(confirmMsg)) return;

  try {
    // 複数の非同期処理を順次実行
    // TODO: Promise.all() を使って並列化すると高速化可能
    for (const file of uploadWorkspace) {
      await saveFileToDB(file);
    }
    alert("保存が完了しました！");
    uploadWorkspace = [];
    renderWorkspace();
  } catch (err) {
    console.error(err);
    alert("保存中にエラーが発生しました。");
  }
});


// --- 「ダウンロード(.zip)」ボタン (Zip圧縮して保存) ---
exportBtn.addEventListener("click", async () => {
  if (downloadWorkspace.length === 0) {
    alert("ダウンロードするファイルが選択されていません。");
    return;
  }

  // 外部ライブラリ JSZip の依存確認
  if (typeof JSZip === "undefined") {
    alert("JSZip ライブラリが読み込まれていません。");
    return;
  }

  const zip = new JSZip();
  
  // ダウンロードリストのファイルをZip構造に追加
  downloadWorkspace.forEach(f => {
    // DBに保存されていたBlobデータをそのまま渡す
    zip.file(f.name, f.data);
  });

  try {
    // Blob形式でZipファイルを生成
    const content = await zip.generateAsync({ type: "blob" });
    
    // 生成したBlobをダウンロードリンクとして機能させる
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "minidrive_files.zip";
    document.body.appendChild(a); // Firefox等の一部ブラウザ対策
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // メモリ解放

  } catch (err) {
    console.error(err);
    alert("ZIPファイルの生成に失敗しました。");
  }
});


// --- 「すべて削除」ボタン ---
deleteAllBtn.addEventListener("click", () => {
  const isUploadMode = toggle.checked;
  const targetName = isUploadMode ? "アップロード" : "ダウンロード";
  
  if (!confirm(`${targetName}リストのファイルをすべて削除しますか？`)) return;

  if (isUploadMode) {
    uploadWorkspace = [];
  } else {
    downloadWorkspace = [];
  }
  renderWorkspace();
});

// =========================================================
// 4. 認証・ログアウト処理 (追加修正)20251218
// =========================================================

// 画面読み込み時にログイン状態をチェック
// ※ログインしていないのに index.html を直接開こうとした場合、追い返す

// ログアウトボタンの処理
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    // 1. 確認ダイアログ（UX向上）
    if (!confirm("ログアウトしますか？")) return;

    // 2. セッション情報の削除（ローカルストレージをクリア）
    localStorage.removeItem("currentUser");

    // 3. ログイン画面へ戻る
    window.location.href = "login.html";
  });
}

// =========================================================
// 消えてしまった関数たちの復活
// =========================================================

// 作業領域（選択中のファイル一覧）の描画
function renderWorkspace() {
  uploadFileListEl.innerHTML = "";
  downloadFileListEl.innerHTML = "";
  const isUploadMode = toggle.checked;

  // モードに応じて描画対象の配列を切り替え
  if (isUploadMode) {
    uploadWorkspace.forEach((f, index) => {
      const li = createListItem(f.name, f.size, index, "upload");
      uploadFileListEl.appendChild(li);
    });
  } else {
    downloadWorkspace.forEach((f, index) => {
      const li = createListItem(f.name, f.size, index, "download");
      downloadFileListEl.appendChild(li);
    });
  }
}

// リストアイテム生成ヘルパー
function createListItem(name, size, index, type) {
  const li = document.createElement("li");
  
  li.innerHTML = `
    <span>${name} (${formatSize(size)})</span>
    <button class="del-btn" style="padding:2px 6px; cursor:pointer;">削除</button>
  `;

  // 削除ボタンのイベント
  li.querySelector(".del-btn").addEventListener("click", () => {
    if (type === "upload") {
      uploadWorkspace.splice(index, 1);
    } else {
      downloadWorkspace.splice(index, 1);
    }
    renderWorkspace();
  });

  return li;
}