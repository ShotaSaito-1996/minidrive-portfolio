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
      createdAt: new Date()
    });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * 全ファイル読み込み (サーバーリスト表示用)
 * カーソル(Cursor)を使って全件走査します。
 */
async function loadFilesFromDB() {
  return new Promise((resolve) => {
    const tx = db.transaction("files", "readonly");
    const store = tx.objectStore("files");
    const result = [];
    const request = store.openCursor();

    request.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        result.push(cursor.value);
        cursor.continue(); // 次のデータへ
      } else {
        resolve(result); // 全件取得完了
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
async function updateUI() {
  const isUploadMode = toggle.checked;

  if (isUploadMode) {
    // --- アップロードモード ---
    mainTitle.textContent = "ファイルアップロード";
    modeLabel.textContent = "アップロード";
    
    // 表示切替: アップロード機能を有効化
    fileBtn.style.display = "inline-block";
    folderBtn.style.display = "inline-block";
    uploadBtn.style.display = "inline-block";
    dropzone.style.opacity = "1";
    
    // 表示切替: ダウンロード機能を無効化
    downloadContainer.style.display = "none";
    exportBtn.style.display = "none";

  } else {
    // --- ダウンロードモード ---
    mainTitle.textContent = "ファイルダウンロード";
    modeLabel.textContent = "ダウンロード";

    // 表示切替: アップロード機能を無効化
    fileBtn.style.display = "none";
    folderBtn.style.display = "none";
    uploadBtn.style.display = "none";
    dropzone.style.opacity = "0.5"; // DnDできないことを視覚的に伝達

    // 表示切替: ダウンロード機能を有効化
    downloadContainer.style.display = "block";
    exportBtn.style.display = "inline-block";

    // DBから最新リストを取得して描画
    await renderServerFileList();
  }

  // 作業領域（選択中のファイルリスト）の再描画
  renderWorkspace();
}

// サーバーファイルリスト（DBの中身）のDOM生成
async function renderServerFileList() {
  const files = await loadFilesFromDB();
  serverFileListEl.innerHTML = "";

  // 空の状態ハンドリング
  if (files.length === 0) {
    emptyMessage.classList.remove("hidden");
    emptyMessage.style.display = "block";
  } else {
    emptyMessage.classList.add("hidden");
    emptyMessage.style.display = "none";
  }

  // リスト生成
  files.forEach((f) => {
    const li = document.createElement("li");
    // Flexboxでレイアウト調整
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";
    li.style.padding = "5px 0";
    li.style.borderBottom = "1px solid #eee";

    // ファイル名とサイズ
    const infoSpan = document.createElement("span");
    infoSpan.textContent = `${f.name} (${formatSize(f.size)})`;

    // 「＋」ボタン: ダウンロード候補に追加
    const addBtn = document.createElement("button");
    addBtn.textContent = "＋";
    addBtn.style.marginLeft = "10px";
    addBtn.addEventListener("click", () => addToDownloadWorkspace(f));

    li.appendChild(infoSpan);
    li.appendChild(addBtn);
    serverFileListEl.appendChild(li);
  });
}

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