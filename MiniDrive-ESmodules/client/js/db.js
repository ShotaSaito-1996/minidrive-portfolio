// js/db.js

let db; // モジュール内のローカル変数（外部からは見えない）

/**
 * DB初期化プロセス
 */
export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("MiniDriveDB", 1);

    request.onupgradeneeded = function (e) {
      db = e.target.result;
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
 * ファイル保存処理
 * @param {File} file - ファイルオブジェクト
 * @param {string} ownerName - 所有者のユーザー名（重要！）
 */
export async function saveFileToDB(file, ownerName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    
    const request = store.add({
      name: file.name,
      type: file.type,
      size: file.size,
      data: file, 
      lastModified: file.lastModified,
      createdAt: new Date(),
      owner: ownerName // ★所有者情報を保存
    });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * 全ファイル読み込み（所有者フィルタリング付き）
 * @param {string} currentUserName - 現在のユーザー名
 */
export async function loadFilesFromDB(currentUserName) {
  return new Promise((resolve) => {
    const tx = db.transaction("files", "readonly");
    const store = tx.objectStore("files");
    const result = [];
    const request = store.openCursor();

    request.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const fileData = cursor.value;
        // 所有者が一致するデータ、または所有者情報がない(古い)データのみ抽出
        if (!fileData.owner || fileData.owner === currentUserName) {
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
 * ファイル削除
 */
export async function deleteFileFromDB(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}