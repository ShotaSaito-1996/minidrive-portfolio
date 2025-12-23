// js/ui.js
import { formatSize } from './utils.js';
import { loadFilesFromDB, deleteFileFromDB, saveFileToDB } from './db.js';
import { getCurrentUser } from './auth.js';

// ---------- DOM 要素 ----------
const toggle = document.getElementById("modeToggle");
const mainTitle = document.getElementById("mainTitle");
const modeLabel = document.getElementById("modeLabel");
const dropzone = document.getElementById("dropzone");
const uploadFileListEl = document.getElementById("uploadFileList");
const downloadFileListEl = document.getElementById("downloadFileList");
const downloadContainer = document.getElementById("downloadContainer");
const serverFileListEl = document.getElementById("serverFileList");
const emptyMessage = document.getElementById("emptyMessage");

// ボタン類（main.jsでのイベント設定用ではなく、ここでの表示切替用）
const fileBtn = document.getElementById("fileBtn");
const folderBtn = document.getElementById("folderBtn");
const uploadBtn = document.getElementById("uploadBtn");
const exportBtn = document.getElementById("exportBtn");

// ---------- 状態管理変数 ----------
let uploadWorkspace = [];
let downloadWorkspace = [];

// ---------- 公開関数 (Mainから呼ばれるもの) ----------

/**
 * ワークスペースのリセット（モード切替時など）
 */
export function resetWorkspaces() {
  uploadWorkspace = [];
  downloadWorkspace = [];
}

/**
 * UIの更新（モードに応じた表示切替）
 */
export async function updateUI() {
  const isUploadMode = toggle.checked;
  const user = getCurrentUser();

  if (isUploadMode) {
    // --- アップロードモード ---
    mainTitle.textContent = "ファイルアップロード";
    modeLabel.textContent = "アップロード";
    
    fileBtn.style.display = "inline-block";
    folderBtn.style.display = "inline-block";
    uploadBtn.style.display = "inline-block";
    dropzone.style.display = "block";
    
    downloadContainer.style.display = "none";
    exportBtn.style.display = "none";

  } else {
    // --- ダウンロードモード ---
    mainTitle.textContent = "ファイルダウンロード";
    modeLabel.textContent = "ダウンロード";

    fileBtn.style.display = "none";
    folderBtn.style.display = "none";
    uploadBtn.style.display = "none";
    dropzone.style.display = "none";

    downloadContainer.style.display = "block";
    exportBtn.style.display = "inline-block";

    // DBからリストを取得して描画（ユーザーフィルタリング付き）
    if (user) {
      await renderServerFileList(user.userName);
    }
  }
  renderWorkspace();
}

/**
 * アップロード作業領域にファイルを追加
 */
export function addFilesToUploadWorkspace(files) {
  uploadWorkspace = uploadWorkspace.concat(files);
  renderWorkspace();
}

// ---------- アクションハンドラ (ボタン処理の実体) ----------

/**
 * [アップロード] ボタン処理
 */
export async function handleUploadAction() {
  if (uploadWorkspace.length === 0) {
    alert("ファイルが選択されていません。");
    return;
  }
  if (!confirm(`選択された ${uploadWorkspace.length} 件のファイルを保存しますか？`)) return;

  const user = getCurrentUser();
  if (!user) {
    alert("ログインセッションが切れています。");
    return;
  }

  try {
    for (const file of uploadWorkspace) {
      // DBモジュールの関数を使用（所有者情報を渡す）
      await saveFileToDB(file, user.userName);
    }
    alert("保存が完了しました！");
    uploadWorkspace = [];
    renderWorkspace();
  } catch (err) {
    console.error(err);
    alert("保存中にエラーが発生しました。");
  }
}

/**
 * [ダウンロード(.zip)] ボタン処理
 */
export async function handleExportAction() {
  if (downloadWorkspace.length === 0) {
    alert("ダウンロードするファイルが選択されていません。");
    return;
  }
  if (typeof JSZip === "undefined") {
    alert("JSZip ライブラリが読み込まれていません。");
    return;
  }

  const zip = new JSZip();
  downloadWorkspace.forEach(f => {
    zip.file(f.name, f.data);
  });

  try {
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "minidrive_files.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("ZIPファイルの生成に失敗しました。");
  }
}

/**
 * [すべて削除] ボタン処理
 */
export function handleDeleteAllAction() {
  const isUploadMode = toggle.checked;
  const targetName = isUploadMode ? "アップロード" : "ダウンロード";
  
  if (!confirm(`${targetName}リストのファイルをすべて削除しますか？`)) return;

  if (isUploadMode) {
    uploadWorkspace = [];
  } else {
    downloadWorkspace = [];
  }
  renderWorkspace();
}

// ---------- 内部関数 (Rendering) ----------

async function renderServerFileList(currentUserName) {
  const files = await loadFilesFromDB(currentUserName);
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
    li.style.padding = "10px";
    li.style.borderBottom = "1px solid #eee";

    // ファイル名（省略表示対応）
    const infoSpan = document.createElement("span");
    infoSpan.textContent = `${f.name} (${formatSize(f.size)})`;
    infoSpan.style.overflow = "hidden";
    infoSpan.style.textOverflow = "ellipsis";
    infoSpan.style.whiteSpace = "nowrap";
    infoSpan.style.marginRight = "10px";

    // ボタンエリア
    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.gap = "5px"; 
    btnGroup.style.flexShrink = "0";

    // [＋追加]
    const addBtn = document.createElement("button");
    addBtn.textContent = "＋追加";
    addBtn.style.cursor = "pointer";
    addBtn.style.padding = "8px 20px";
    addBtn.style.whiteSpace = "nowrap";
    addBtn.addEventListener("click", () => addToDownloadWorkspace(f));

    // [削除]
    const delBtn = document.createElement("button");
    delBtn.textContent = "削除";
    delBtn.style.backgroundColor = "#ff4444"; 
    delBtn.style.color = "white";
    delBtn.style.border = "none";
    delBtn.style.borderRadius = "4px";
    delBtn.style.padding = "8px 20px";
    delBtn.style.cursor = "pointer";
    delBtn.style.whiteSpace = "nowrap";
    delBtn.addEventListener("click", async () => {
      if(confirm(`「${f.name}」を完全に削除しますか？`)) {
        await deleteFileFromDB(f.id);
        await renderServerFileList(currentUserName);
      }
    });

    btnGroup.appendChild(addBtn);
    btnGroup.appendChild(delBtn);
    li.appendChild(infoSpan);
    li.appendChild(btnGroup);
    serverFileListEl.appendChild(li);
  });
}

function renderWorkspace() {
  uploadFileListEl.innerHTML = "";
  downloadFileListEl.innerHTML = "";
  const isUploadMode = toggle.checked;

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

function createListItem(name, size, index, type) {
  const li = document.createElement("li");
  li.innerHTML = `
    <span>${name} (${formatSize(size)})</span>
    <button class="del-btn" style="padding:2px 6px; cursor:pointer;">削除</button>
  `;
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

function addToDownloadWorkspace(file) {
  downloadWorkspace.push(file);
  renderWorkspace();
}