// ポップアップの JavaScript
document.addEventListener('DOMContentLoaded', async function() {
    const currentSiteName = document.getElementById('currentSiteName');
    const notBlockedState = document.getElementById('notBlockedState');
    const alreadyBlockedState = document.getElementById('alreadyBlockedState');
    const blockCurrentSiteBtn = document.getElementById('blockCurrentSiteBtn');
    const unblockCurrentSiteBtn = document.getElementById('unblockCurrentSiteBtn');
    const openOptionsBtn = document.getElementById('openOptionsBtn');
    const blockedSitesCount = document.getElementById('count');

    let currentSite = '';
    
    // 現在のタブの情報を取得
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            const url = new URL(tabs[0].url);
            currentSite = normalizeSite(url.hostname);
            currentSiteName.textContent = currentSite;
            
            // Chrome拡張ページなど特殊なページの場合
            if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
                currentSiteName.textContent = 'Chrome内部ページ';
                notBlockedState.style.display = 'none';
                alreadyBlockedState.style.display = 'none';
            } else {
                await updateBlockStatus();
            }
        }
    } catch (error) {
        console.error('Error getting current tab:', error);
        currentSiteName.textContent = '取得できませんでした';
    }

    // ブロック中のサイト数を表示
    await updateBlockedSitesCount();

    // ブロックボタンのクリックイベント
    blockCurrentSiteBtn.addEventListener('click', async function() {
        await addCurrentSiteToBlocklist();
    });

    // ブロック解除ボタンのクリックイベント
    unblockCurrentSiteBtn.addEventListener('click', async function() {
        await removeCurrentSiteFromBlocklist();
    });

    // 設定画面を開くボタンのクリックイベント
    openOptionsBtn.addEventListener('click', function() {
        chrome.runtime.openOptionsPage();
        window.close();
    });

    // 現在のサイトのブロック状況を更新する関数
    async function updateBlockStatus() {
        try {
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];
            
            const isBlocked = blockedSites.includes(currentSite);
            
            if (isBlocked) {
                notBlockedState.style.display = 'none';
                alreadyBlockedState.style.display = 'block';
            } else {
                notBlockedState.style.display = 'block';
                alreadyBlockedState.style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking block status:', error);
        }
    }

    // ブロック中のサイト数を更新する関数
    async function updateBlockedSitesCount() {
        try {
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];
            blockedSitesCount.textContent = blockedSites.length;
        } catch (error) {
            console.error('Error updating count:', error);
        }
    }

    // 現在のサイトをブロックリストに追加する関数
    async function addCurrentSiteToBlocklist() {
        try {
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];

            if (!blockedSites.includes(currentSite)) {
                blockedSites.push(currentSite);
                await chrome.storage.local.set({ blockedSites });
                
                await updateBlockStatus();
                await updateBlockedSitesCount();
                
                // 成功メッセージ（オプション）
                showMessage(`${currentSite} をブロックリストに追加しました`);
            }
        } catch (error) {
            console.error('Error adding site to blocklist:', error);
            showMessage('エラーが発生しました', 'error');
        }
    }

    // 現在のサイトをブロックリストから削除する関数
    async function removeCurrentSiteFromBlocklist() {
        try {
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];

            const updatedSites = blockedSites.filter(site => site !== currentSite);
            await chrome.storage.local.set({ blockedSites: updatedSites });
            
            await updateBlockStatus();
            await updateBlockedSitesCount();
            
            showMessage(`${currentSite} のブロックを解除しました`);
        } catch (error) {
            console.error('Error removing site from blocklist:', error);
            showMessage('エラーが発生しました', 'error');
        }
    }

    // URLを正規化する関数
    function normalizeSite(hostname) {
        return hostname.toLowerCase().replace(/^www\./, '');
    }

    // 一時的なメッセージを表示する関数
    function showMessage(message, type = 'success') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            right: 10px;
            padding: 8px;
            background: ${type === 'error' ? '#ff4444' : '#44aa44'};
            color: white;
            border-radius: 4px;
            font-size: 12px;
            text-align: center;
            z-index: 1000;
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 2000);
    }
});