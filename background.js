// Service Worker for FlexibleBlocker

// 最近処理したURLを記録（重複防止）
const recentlyProcessed = new Map();

// ブロック処理を行う関数
async function checkAndBlockUrl(details, eventType) {
  // メインフレームのナビゲーションのみ処理
  if (details.frameId !== 0) return;
  
  try {
    console.log(`[FlexibleBlocker] ${eventType} event for URL:`, details.url);
    
    const url = new URL(details.url);
    
    // Chrome拡張の内部URLはスキップ
    if (url.protocol === 'chrome-extension:') {
      return;
    }
    
    // 重複処理を防ぐ（同じURLを短時間で複数回処理しない）
    const urlKey = `${details.tabId}-${details.url}`;
    const now = Date.now();
    if (recentlyProcessed.has(urlKey) && now - recentlyProcessed.get(urlKey) < 1000) {
      console.log(`[FlexibleBlocker] Recently processed, skipping:`, details.url);
      return;
    }
    recentlyProcessed.set(urlKey, now);
    
    // 古いエントリを削除（メモリリーク防止）
    for (const [key, time] of recentlyProcessed.entries()) {
      if (now - time > 5000) {
        recentlyProcessed.delete(key);
      }
    }
    
    // ブロックされたサイトのリストを取得
    const result = await chrome.storage.local.get(['blockedSites']);
    const blockedSites = result.blockedSites || [];
    
    console.log(`[FlexibleBlocker] Blocked sites:`, blockedSites);
    
    // 現在のサイトがブロック対象かチェック
    const matchingRules = blockedSites.filter(blockedSite => {
      const matches = isUrlBlocked(details.url, blockedSite);
      if (matches) {
        console.log(`[FlexibleBlocker] URL matches rule:`, blockedSite);
      }
      return matches;
    });
    
    if (matchingRules.length > 0) {
      console.log(`[FlexibleBlocker] Blocking URL with rules:`, matchingRules);
      
      // ブロック画面にリダイレクト
      const blockUrl = chrome.runtime.getURL('block.html') + '?blocked=' + encodeURIComponent(details.url);
      
      try {
        // 少し遅延を入れて確実に処理
        await new Promise(resolve => setTimeout(resolve, 50));
        await chrome.tabs.update(details.tabId, { url: blockUrl });
        console.log(`[FlexibleBlocker] Redirected to block page`);
      } catch (updateError) {
        console.error('Error updating tab:', updateError);
      }
    } else {
      console.log(`[FlexibleBlocker] URL not blocked`);
    }
  } catch (error) {
    console.error('Error in background script:', error);
  }
}

// 複数のナビゲーションイベントでブロックを試行
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  checkAndBlockUrl(details, 'onBeforeNavigate');
});

chrome.webNavigation.onCommitted.addListener((details) => {
  checkAndBlockUrl(details, 'onCommitted');
});

chrome.webNavigation.onDOMContentLoaded.addListener((details) => {
  checkAndBlockUrl(details, 'onDOMContentLoaded');
});

// タブ更新イベントも監視
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // URLが変更された場合のみ処理
  if (changeInfo.url && tab.url && tab.url !== 'chrome://newtab/' && !tab.url.startsWith('chrome-extension:')) {
    const details = {
      tabId: tabId,
      url: tab.url,
      frameId: 0
    };
    
    await checkAndBlockUrl(details, 'onTabUpdated');
  }
});

// 拡張機能のアイコンがクリックされた時の処理は popup.js で処理

// URLがブロック対象かどうかを判定する関数
function isUrlBlocked(currentUrl, blockedSite) {
  try {
    const url = new URL(currentUrl);
    let hostname = url.hostname;
    const pathname = url.pathname;
    
    // www. を除去
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    
    // 現在のURLをパス込みで構築（/ から始まるパスを除去）
    const fullPath = hostname + pathname;
    const pathParts = pathname.split('/').filter(part => part.length > 0);
    
    // ブロック対象のサイトを / で分割
    const blockedParts = blockedSite.split('/');
    const blockedDomain = blockedParts[0];
    const blockedPathParts = blockedParts.slice(1);
    
    // 1. ドメインが一致しない場合はブロック対象外
    if (hostname !== blockedDomain) {
      return false;
    }
    
    // 2. ドメインのみの設定の場合（パス指定なし）
    if (blockedPathParts.length === 0) {
      return true; // ドメインが一致すればブロック
    }
    
    // 3. パス部分の一致チェック
    for (let i = 0; i < blockedPathParts.length; i++) {
      if (i >= pathParts.length) {
        return false; // 現在のURLの方が短い
      }
      
      if (pathParts[i] !== blockedPathParts[i]) {
        return false; // パス部分が一致しない
      }
    }
    
    // すべてのブロック対象パス部分が一致した
    return true;
    
  } catch (error) {
    console.error('Error checking URL:', error);
    return false;
  }
}