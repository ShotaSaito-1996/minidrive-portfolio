// js/main.js
import { openDatabase } from './db.js';
import { getCurrentUser } from './auth.js';
import * as UI from './ui.js';

// 初期化プロセス
window.addEventListener("DOMContentLoaded", async () => {
  // ログインチェック
  const user = getCurrentUser();
  if (!user) {
    // ログインしていなければリダイレクト
    window.location.href = "login.html";
    return;
  }

  try {
    // DB接続とUI初期化
    await openDatabase();
    await UI.updateUI();
  } catch (e) {
    console.error(e);
    alert("アプリケーションの初期化に失敗しました。");
  }
});

// ---------- イベントリスナーの設定 ----------

// モード切替
document.getElementById("modeToggle").addEventListener("change", () => {
  UI.resetWorkspaces();
  UI.updateUI();
});

// ファイル選択ボタン連携
const fileInput = document.getElementById("fileInput");
const folderInput = document.getElementById("folderInput");

document.getElementById("fileBtn").addEventListener("click", () => fileInput.click());
document.getElementById("folderBtn").addEventListener("click", () => folderInput.click());

fileInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  UI.addFilesToUploadWorkspace(files);
  fileInput.value = "";
});

folderInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  UI.addFilesToUploadWorkspace(files);
  folderInput.value = "";
});

// アクションボタン
document.getElementById("uploadBtn").addEventListener("click", () => {
  UI.handleUploadAction();
});

document.getElementById("exportBtn").addEventListener("click", () => {
  UI.handleExportAction();
});

document.getElementById("deleteAllBtn").addEventListener("click", () => {
  UI.handleDeleteAllAction();
});

// ドラッグ＆ドロップ
const dropzone = document.getElementById("dropzone");
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.style.backgroundColor = "#e0f7fa";
  dropzone.style.border = "2px dashed #00bcd4";
});
dropzone.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dropzone.style.backgroundColor = "";
  dropzone.style.border = "";
});
// js/main.js の drop イベントリスナー

dropzone.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropzone.style.backgroundColor = "";
  dropzone.style.border = "";

  const isUploadMode = document.getElementById("modeToggle").checked;
  if (!isUploadMode) {
    alert("現在はダウンロードモードです。");
    return;
  }

  // ここからフォルダ対応ロジック
  const items = e.dataTransfer.items;
  if (!items) return;

  const files = [];
  const queue = []; // 処理待ちリスト

  // ドロップされたものをスキャン用キューに入れる
  for (let i = 0; i < items.length; i++) {
    // webkitGetAsEntry() はフォルダの中身を見るための魔法のメソッド
    const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
    if (entry) {
      queue.push(traverseFileTree(entry));
    }
  }

  // 全てのスキャンが終わるのを待つ
  // (フォルダの中身を全て配列 files に詰め込む)
  await Promise.all(queue).then((results) => {
    // resultsは配列の配列になっているのでフラットにする
    results.forEach(fileArray => {
      files.push(...fileArray);
    });
  });

  if (files.length > 0) {
    UI.addFilesToUploadWorkspace(files);
  }
});

// ログアウト処理
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (!confirm("ログアウトしますか？")) return;
    localStorage.removeItem("currentUser");
    window.location.href = "login.html";
  });
}

// ==========================================
// フォルダ読み込み用ヘルパー関数 (再帰処理)
// ==========================================

/**
 * ファイルまたはディレクトリのエントリーを再帰的に走査してFileオブジェクトを収集する
 * @param {FileSystemEntry} item - エントリー
 * @param {string} path - (今回は未使用だが将来的にパス階層を使う場合に利用)
 * @returns {Promise<File[]>}
 */
function traverseFileTree(item, path = "") {
  return new Promise((resolve) => {
    if (item.isFile) {
      // ファイルの場合: Fileオブジェクトを取得して返す
      item.file((file) => {
        // 必要であればここで file.name を path + file.name に書き換える処理も可能
        resolve([file]);
      });
    } else if (item.isDirectory) {
      // ディレクトリの場合: 中身を読み込む
      const dirReader = item.createReader();
      const entries = [];

      // readEntriesは一度に全て取得できない場合があるので再帰的に読む必要があるが、
      // 簡易版として一度読み込みを行う
      const readEntries = () => {
        dirReader.readEntries(async (result) => {
          if (result.length === 0) {
            // これ以上読み込むものがない場合
            // 集めたエントリー(entries)をさらに再帰スキャンして解決
            const subPromises = entries.map(entry => traverseFileTree(entry, path + item.name + "/"));
            const subFilesArrays = await Promise.all(subPromises);
            // 結果を平坦化して返す
            resolve(subFilesArrays.flat());
          } else {
            // まだ中身がある場合、リストに追加して次を読む
            entries.push(...result);
            readEntries();
          }
        });
      };
      readEntries();
    } else {
        // ファイルでもフォルダでもない場合
        resolve([]);
    }
  });
}