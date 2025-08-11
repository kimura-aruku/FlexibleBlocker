// ブロック画面の JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const blockedUrl = document.getElementById('blockedUrl');
    const blockTimeRange = document.getElementById('blockTimeRange');
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const unblockBtn = document.getElementById('unblockBtn');
    const blockTime = document.getElementById('blockTime');

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

    // ブロック時刻を表示
    const now = new Date();
    blockTime.textContent = now.toLocaleString('ja-JP');

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
            
            // 現在のURLにマッチするすべてのブロックルールを見つける
            const matchingSites = blockedSites.filter(blockedSite => {
                return isUrlBlocked(currentUrl, blockedSite);
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

    // URLがブロック対象かどうかを判定する関数（background.jsと同じロジック）
    function isUrlBlocked(currentUrl, siteInfo) {
        try {
            const url = new URL(currentUrl);
            let hostname = url.hostname;
            const pathname = url.pathname;
            
            // www. を除去
            if (hostname.startsWith('www.')) {
                hostname = hostname.substring(4);
            }
            
            const pathParts = pathname.split('/').filter(part => part.length > 0);
            
            // ブロック対象のサイトを / で分割
            const blockedParts = siteInfo.url.split('/');
            const blockedDomain = blockedParts[0];
            const blockedPathParts = blockedParts.slice(1);
            
            // 1. ドメインが一致しない場合はブロック対象外
            if (hostname !== blockedDomain) {
                return false;
            }
            
            // 2. ドメインのみの設定の場合（パス指定なし）
            if (blockedPathParts.length === 0) {
                // ドメインが一致した場合、時間帯をチェック
                return isCurrentTimeBlocked(siteInfo.fromTime, siteInfo.toTime);
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
            
            // URLマッチした場合、時間帯をチェック
            return isCurrentTimeBlocked(siteInfo.fromTime, siteInfo.toTime);
            
        } catch (error) {
            console.error('Error checking URL:', error);
            return false;
        }
    }

    // 現在時刻がブロック時間帯に含まれるかをチェックする関数
    function isCurrentTimeBlocked(fromTime, toTime) {
        if (fromTime === '00:00' && toTime === '23:59') {
            return true; // 終日ブロック
        }
        
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        
        // 時間を分に変換して比較
        const currentMinutes = timeToMinutes(currentTime);
        const fromMinutes = timeToMinutes(fromTime);
        const toMinutes = timeToMinutes(toTime);
        
        if (fromMinutes <= toMinutes) {
            // 通常の場合（例: 09:00-17:00）
            return currentMinutes >= fromMinutes && currentMinutes <= toMinutes;
        } else {
            // 日をまたぐ場合（例: 22:00-06:00）
            return currentMinutes >= fromMinutes || currentMinutes <= toMinutes;
        }
    }
    
    // HH:MM形式の時間を分に変換する関数
    function timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // 時間帯を表示用にフォーマットする関数
    function formatTimeRange(fromTime, toTime) {
        if (fromTime === '00:00' && toTime === '23:59') {
            return '終日';
        }
        return `${fromTime}～${toTime}`;
    }

    // URLを正規化する関数
    function normalizeSite(hostname) {
        return hostname.toLowerCase().replace(/^www\./, '');
    }

    // キーボードショートカット
    document.addEventListener('keydown', function(e) {
        // Enterキーで設定を開く
        if (e.key === 'Enter') {
            openSettingsBtn.click();
        }
    });
});