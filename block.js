// ブロック画面の JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const blockedUrl = document.getElementById('blockedUrl');
    const blockTimeRange = document.getElementById('blockTimeRange');
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const unblockBtn = document.getElementById('unblockBtn');

    // URLパラメータから元のURLを取得
    const urlParams = new URLSearchParams(window.location.search);
    const originalUrl = urlParams.get('blocked');
    let matchedBlockRule = null;
    
    if (originalUrl) {
        // 実際にブロックされたルールを特定
        findMatchingBlockRule(originalUrl).then(ruleInfo => {
            matchedBlockRule = ruleInfo;
            if (ruleInfo) {
                blockedUrl.textContent = ruleInfo.url;
                // 時間帯表示を設定
                const timeDisplay = formatTimeRange(ruleInfo.fromTime, ruleInfo.toTime);
                blockTimeRange.textContent = timeDisplay;
            } else {
                try {
                    const url = new URL(originalUrl);
                    blockedUrl.textContent = url.hostname;
                    blockTimeRange.textContent = '終日';
                } catch (error) {
                    blockedUrl.textContent = originalUrl;
                    blockTimeRange.textContent = '終日';
                }
            }
        });
    } else {
        blockedUrl.textContent = 'Unknown Site';
        blockTimeRange.textContent = '終日';
    }


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

        // 実際のブロックルールを取得
        if (!matchedBlockRule) {
            matchedBlockRule = await findMatchingBlockRule(originalUrl);
        }

        if (!matchedBlockRule) {
            alert('ブロックルールが見つかりませんでした');
            return;
        }

        try {
            // ブロックリストから実際のルールを削除
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];
            const updatedSites = blockedSites.filter(site => {
                const url = typeof site === 'string' ? site : site.url;
                return url !== matchedBlockRule.url;
            });
            
            await chrome.storage.local.set({ blockedSites: updatedSites });
            
            // 元のサイトにリダイレクト
            window.location.href = originalUrl;
            
        } catch (error) {
            console.error('Error unblocking site:', error);
            alert('ブロック解除に失敗しました');
        }
    });

    // ブロックルールを特定する関数
    async function findMatchingBlockRule(currentUrl) {
        try {
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];
            
            // 現在のURLにマッチするすべてのブロックルールを見つける（時間を考慮せず）
            const matchingSites = blockedSites.filter(blockedSite => {
                return isUrlMatchedIgnoreTime(currentUrl, blockedSite);
            });
            
            if (matchingSites.length === 0) {
                return null;
            }
            
            // 最も具体的なルール（最も長いパス）を返す
            return matchingSites.reduce((prev, current) => {
                const prevParts = prev.url.split('/').length;
                const currentParts = current.url.split('/').length;
                
                if (currentParts > prevParts) {
                    return current;
                } else if (currentParts === prevParts) {
                    return current.url.length > prev.url.length ? current : prev;
                } else {
                    return prev;
                }
            });
        } catch (error) {
            console.error('Error finding matching block rule:', error);
            return null;
        }
    }


    // キーボードショートカット
    document.addEventListener('keydown', function(e) {
        // Enterキーで設定を開く
        if (e.key === 'Enter') {
            openSettingsBtn.click();
        }
    });
});