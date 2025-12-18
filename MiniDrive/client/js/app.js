// app.js

// ---------- グローバル変数 ----------
let db;
let uploadWorkspace = [];   // アップロード作業領域（Fileオブジェクト）
let downloadWorkspace = []; // ダウンロード作業領域（DBから取得したオブジェクト）

// ---------- DOM 要素の取得 ----------
const toggle = document.getElementById("modeToggle");
const mainTitle = document.getElementById("mainTitle");
const modeLabel = document.getElementById("modeLabel");

// エリア・リスト
const dropzone = document.getElementById("dropzone");
const uploadFileListEl = document.getElementById("uploadFileList");
const downloadFileListEl = document.getElementById("downloadFileList");
const downloadContainer = document.getElementById("downloadContainer"); // サーバーファイルリストの親
const serverFileListEl = document.getElementById("serverFileList");     // サーバーファイルリスト(ul)
const emptyMessage = document.getElementById("emptyMessage");

// ボタン・入力
const fileBtn = document.getElementById("fileBtn");
const folderBtn = document.getElementById("folderBtn");
const fileInput = document.getElementById("fileInput");
const folderInput = document.getElementById("folderInput");
const deleteAllBtn = document.getElementById("deleteAllBtn");
const exportBtn = document.getElementById("exportBtn"); // ダウンロード(.zip)
const uploadBtn = document.getElementById("uploadBtn"); // アップロード

// =========================================================
// 1. IndexedDB (擬似サーバー) 関連処理
// =========================================================

// DB初期化
function openDatabase() {
  return new Promise((resolve, reject) => {
    // バージョンを管理（今回は簡易的に 1 固定）
    const request = indexedDB.open("MiniDriveDB", 1);

    request.onupgradeneeded = function (e) {
      db = e.target.result;
      // ファイル格納用のストアを作成 (idは自動採番)
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

// ファイル保存 (アップロード処理)
async function saveFileToDB(file) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    const request = store.add({
      name: file.name,
      type: file.type,
      size: file.size,
      data: file, // Fileオブジェクト(Blob)をそのまま保存
      lastModified: file.lastModified,
      createdAt: new Date()
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 全ファイル読み込み (サーバーリスト表示用)
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
        cursor.continue();
      } else {
        resolve(result);
      }
    };
  });
}

// ファイル個別取得 (ID指定)
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
// =========================================================

// モード切替時の表示更新
async function updateUI() {
  const isUploadMode = toggle.checked;

  if (isUploadMode) {
    // --- アップロードモード ---
    mainTitle.textContent = "ファイルアップロード";
    modeLabel.textContent = "アップロード";
    
    // アップロード関連を表示
    fileBtn.style.display = "inline-block";
    folderBtn.style.display = "inline-block";
    uploadBtn.style.display = "inline-block";
    dropzone.style.opacity = "1"; // 有効っぽく見せる
    
    // ダウンロード関連を非表示
    downloadContainer.style.display = "none";
    exportBtn.style.display = "none";

  } else {
    // --- ダウンロードモード ---
    mainTitle.textContent = "ファイルダウンロード";
    modeLabel.textContent = "ダウンロード";

    // アップロード関連を非表示
    fileBtn.style.display = "none";
    folderBtn.style.display = "none";
    uploadBtn.style.display = "none";
    dropzone.style.opacity = "0.5"; // 無効っぽく見せる（DnD抑制のため）

    // ダウンロード関連を表示
    downloadContainer.style.display = "block";
    exportBtn.style.display = "inline-block";

    // サーバー上のファイルリストを更新
    await renderServerFileList();
  }

  // 作業領域（リスト）も再描画
  renderWorkspace();
}

// サーバーファイルリスト（DBの中身）の描画
async function renderServerFileList() {
  const files = await loadFilesFromDB();
  serverFileListEl.innerHTML = "";

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
    li.style.padding = "5px 0";
    li.style.borderBottom = "1px solid #eee";

    // 名前とサイズ
    const infoSpan = document.createElement("span");
    infoSpan.textContent = `${f.name} (${formatSize(f.size)})`;

    // 追加ボタン
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

  if (isUploadMode) {
    // アップロード作業領域の表示
    uploadWorkspace.forEach((f, index) => {
      const li = createListItem(f.name, f.size, index, "upload");
      uploadFileListEl.appendChild(li);
    });
  } else {
    // ダウンロード作業領域の表示
    downloadWorkspace.forEach((f, index) => {
      const li = createListItem(f.name, f.size, index, "download");
      downloadFileListEl.appendChild(li);
    });
  }
}

// リストアイテム生成ヘルパー
function createListItem(name, size, index, type) {
  const li = document.createElement("li");
  /*li.style.display = "flex";
  li.style.justifyContent = "space-between";
  li.style.alignItems = "center";
  li.style.padding = "5px 0";*/

  li.innerHTML = `
    <span>${name} (${formatSize(size)})</span>
    <button class="del-btn" style="padding:2px 6px;">削除</button>
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

// サイズ表記の整形
function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  return Math.round(bytes / 1024) + " KB";
}


// =========================================================
// 3. イベントリスナー (操作系)
// =========================================================

// --- 初期化 ---
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await openDatabase();
    await updateUI();
  } catch (e) {
    console.error(e);
    alert("初期化エラーが発生しました");
  }
});

// --- トグル切替 ---
toggle.addEventListener("change", () => {
  // モード切替時に作業領域をリセット（仕様通り）
  uploadWorkspace = [];
  downloadWorkspace = [];
  updateUI();
});

// --- ファイル選択ボタン連携 ---
fileBtn.addEventListener("click", () => fileInput.click());
folderBtn.addEventListener("click", () => folderInput.click());

fileInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  addFilesToUploadWorkspace(files);
  fileInput.value = ""; // リセット
});

folderInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  addFilesToUploadWorkspace(files);
  folderInput.value = ""; // リセット
});

function addFilesToUploadWorkspace(files) {
  // 重複チェックは簡易的に省略（必要なら追加可能）
  uploadWorkspace = uploadWorkspace.concat(files);
  renderWorkspace();
}

// --- ドラッグ＆ドロップ (DnD) ---
// ドラッグ中：スタイル変更
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (toggle.checked) {
    dropzone.style.backgroundColor = "#e0f7fa"; // 色を変えてフィードバック
    dropzone.style.border = "2px dashed #00bcd4";
  }
});

// ドラッグ離脱：スタイル戻す
dropzone.addEventListener("dragleave", (e) => {
  e.preventDefault();
  resetDropzoneStyle();
});

// ドロップ：ファイル追加
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  resetDropzoneStyle();

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
  dropzone.style.border = ""; // CSSのデフォルトに戻る
}


// --- サーバーファイルリストからの追加 (ダウンロードモード用) ---
function addToDownloadWorkspace(dbFile) {
  // 既にリストにあるか確認（オプション）
  // const exists = downloadWorkspace.some(f => f.id === dbFile.id);
  // if (exists) return;
  downloadWorkspace.push(dbFile);
  renderWorkspace();
}


// --- 「アップロード」ボタン (DBへ保存) ---
uploadBtn.addEventListener("click", async () => {
  if (uploadWorkspace.length === 0) {
    alert("ファイルが選択されていません。");
    return;
  }

  const confirmMsg = `選択された ${uploadWorkspace.length} 件のファイルを保存しますか？`;
  if (!confirm(confirmMsg)) return;

  try {
    // 順番に保存
    for (const file of uploadWorkspace) {
      await saveFileToDB(file);
    }
    alert("保存が完了しました！");
    uploadWorkspace = []; // 完了したらクリア
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

  if (typeof JSZip === "undefined") {
    alert("JSZip ライブラリが読み込まれていません。");
    return;
  }

  const zip = new JSZip();
  
  // ダウンロードリストのファイルをZipに追加
  downloadWorkspace.forEach(f => {
    // DBに保存された data (Blob/File) を使う
    zip.file(f.name, f.data);
  });

  try {
    // Zip生成
    const content = await zip.generateAsync({ type: "blob" });
    
    // ダウンロード発火
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "minidrive_files.zip";
    document.body.appendChild(a); // Firefox対策
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

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