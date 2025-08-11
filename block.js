// ブロック画面の JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const blockedUrl = document.getElementById('blockedUrl');
    const goBackBtn = document.getElementById('goBackBtn');
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const unblockBtn = document.getElementById('unblockBtn');
    const blockTime = document.getElementById('blockTime');

    // URLパラメータから元のURLを取得
    const urlParams = new URLSearchParams(window.location.search);
    const originalUrl = urlParams.get('blocked');
    
    if (originalUrl) {
        try {
            const url = new URL(originalUrl);
            blockedUrl.textContent = url.hostname;
        } catch (error) {
            blockedUrl.textContent = originalUrl;
        }
    } else {
        blockedUrl.textContent = 'Unknown Site';
    }

    // ブロック時刻を表示
    const now = new Date();
    blockTime.textContent = now.toLocaleString('ja-JP');

    // 戻るボタンのクリックイベント
    goBackBtn.addEventListener('click', function() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            // 履歴がない場合は新しいタブページに移動
            window.location.href = 'chrome://newtab/';
        }
    });

    // 設定を開くボタンのクリックイベント
    openSettingsBtn.addEventListener('click', function() {
        chrome.runtime.openOptionsPage();
    });

    // ブロック解除リンクのクリックイベント
    unblockBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        
        if (!originalUrl) {
            alert('元のURLが取得できませんでした');
            return;
        }

        const confirmMessage = 'このサイトのブロックを解除しますか？\\n解除後、元のサイトに自動的にリダイレクトします。';
        
        if (confirm(confirmMessage)) {
            try {
                const url = new URL(originalUrl);
                const hostname = normalizeSite(url.hostname);
                
                // ブロックリストから削除
                const result = await chrome.storage.local.get(['blockedSites']);
                const blockedSites = result.blockedSites || [];
                const updatedSites = blockedSites.filter(site => site !== hostname);
                
                await chrome.storage.local.set({ blockedSites: updatedSites });
                
                // 元のサイトにリダイレクト
                window.location.href = originalUrl;
                
            } catch (error) {
                console.error('Error unblocking site:', error);
                alert('ブロック解除に失敗しました');
            }
        }
    });

    // URLを正規化する関数
    function normalizeSite(hostname) {
        return hostname.toLowerCase().replace(/^www\./, '');
    }

    // キーボードショートカット
    document.addEventListener('keydown', function(e) {
        // Escキーで戻る
        if (e.key === 'Escape') {
            goBackBtn.click();
        }
        // Enterキーで設定を開く
        if (e.key === 'Enter') {
            openSettingsBtn.click();
        }
    });
});