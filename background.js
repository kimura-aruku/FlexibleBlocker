// Service Worker for FlexibleBlocker
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // メインフレームのナビゲーションのみ処理
  if (details.frameId !== 0) return;
  
  try {
    const url = new URL(details.url);
    const hostname = url.hostname;
    
    // ブロックされたサイトのリストを取得
    const result = await chrome.storage.local.get(['blockedSites']);
    const blockedSites = result.blockedSites || [];
    
    // 現在のサイトがブロック対象かチェック
    const isBlocked = blockedSites.some(site => {
      // サイト名の完全一致または、www.を除いた一致
      return hostname === site || 
             hostname === `www.${site}` || 
             hostname.replace('www.', '') === site;
    });
    
    if (isBlocked) {
      // ブロック画面にリダイレクト
      const blockUrl = chrome.runtime.getURL('block.html') + '?blocked=' + encodeURIComponent(details.url);
      chrome.tabs.update(details.tabId, { url: blockUrl });
    }
  } catch (error) {
    console.error('Error in background script:', error);
  }
});

// 拡張機能のアイコンがクリックされた時の処理は popup.js で処理