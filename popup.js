// ポップアップの JavaScript
document.addEventListener('DOMContentLoaded', async function() {
    const notBlockedState = document.getElementById('notBlockedState');
    const alreadyBlockedState = document.getElementById('alreadyBlockedState');
    const blockCurrentSiteBtn = document.getElementById('blockCurrentSiteBtn');
    const unblockCurrentSiteBtn = document.getElementById('unblockCurrentSiteBtn');
    const openOptionsBtn = document.getElementById('openOptionsBtn');
    const blockedSitesCount = document.getElementById('count');
    const urlAnalysisSection = document.getElementById('urlAnalysisSection');
    const urlParts = document.getElementById('urlParts');
    const selectedUrl = document.getElementById('selectedUrl');
    const addSelectedBtn = document.getElementById('addSelectedBtn');
    const cancelAnalysisBtn = document.getElementById('cancelAnalysisBtn');
    const blockedRuleName = document.getElementById('blockedRuleName');

    let currentUrl = '';
    let currentTabId = null;
    let currentParsedUrl = null;
    let selectedIndex = -1;
    
    // 現在のタブの情報を取得
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            const url = new URL(tabs[0].url);
            currentUrl = tabs[0].url;
            currentTabId = tabs[0].id;
            
            // Chrome拡張ページなど特殊なページの場合
            if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
                notBlockedState.style.display = 'none';
                alreadyBlockedState.style.display = 'none';
            } else {
                await updateBlockStatus();
            }
        }
    } catch (error) {
        console.error('Error getting current tab:', error);
    }

    // ブロック中のサイト数を表示
    await updateBlockedSitesCount();

    // ブロックボタンのクリックイベント（URL解析処理に変更）
    blockCurrentSiteBtn.addEventListener('click', function() {
        analyzeCurrentUrl();
    });

    // ブロック解除ボタンのクリックイベント
    unblockCurrentSiteBtn.addEventListener('click', async function() {
        await removeCurrentSiteFromBlocklist();
    });

    // 選択されたURLを追加
    addSelectedBtn.addEventListener('click', addSelectedSite);
    
    // キャンセルボタン
    cancelAnalysisBtn.addEventListener('click', function() {
        urlAnalysisSection.style.display = 'none';
        notBlockedState.style.display = 'block';
    });

    // 設定画面を開くボタンのクリックイベント
    openOptionsBtn.addEventListener('click', function() {
        chrome.runtime.openOptionsPage();
        window.close();
    });

    // 現在のURLを解析する関数
    function analyzeCurrentUrl() {
        if (!currentUrl) {
            showMessage('URLが取得できませんでした', 'error');
            return;
        }

        try {
            currentParsedUrl = parseUrl(currentUrl);
            displayUrlParts();
            notBlockedState.style.display = 'none';
            urlAnalysisSection.style.display = 'block';
        } catch (error) {
            console.error('URL parsing error:', error);
            showMessage('URLの解析に失敗しました', 'error');
        }
    }

    // URLを解析してパーツに分割する関数
    function parseUrl(inputUrl) {
        let url = inputUrl;
        
        // プロトコルを除去
        url = url.replace(/^https?:\/\//, '');
        
        // URLの部分を / で分割
        const parts = url.split('/').filter(part => part.length > 0);
        
        if (parts.length === 0) {
            throw new Error('Invalid URL');
        }

        // 最初の部分（ドメイン）から www. を除去
        if (parts[0].startsWith('www.')) {
            parts[0] = parts[0].substring(4);
        }

        return parts;
    }

    // URL部分を表示する関数
    function displayUrlParts() {
        urlParts.innerHTML = '';
        selectedIndex = -1;

        currentParsedUrl.forEach((part, index) => {
            const partElement = document.createElement('span');
            partElement.className = 'url-part';
            partElement.textContent = part;
            partElement.dataset.index = index;
            
            partElement.addEventListener('click', () => selectUrlPart(index));
            
            urlParts.appendChild(partElement);
            
            // / 区切り文字を追加（最後以外）
            if (index < currentParsedUrl.length - 1) {
                const separator = document.createElement('span');
                separator.className = 'url-separator';
                separator.textContent = '/';
                urlParts.appendChild(separator);
            }
        });

        updateSelectedUrl();
    }

    // URL部分を選択する関数
    function selectUrlPart(index) {
        selectedIndex = index;
        
        // 全ての部分のスタイルをリセット
        document.querySelectorAll('.url-part').forEach((element, i) => {
            if (i <= index) {
                element.classList.add('selected');
            } else {
                element.classList.remove('selected');
            }
        });

        updateSelectedUrl();
    }

    // 選択されたURLを更新する関数
    function updateSelectedUrl() {
        if (selectedIndex >= 0 && currentParsedUrl) {
            const selectedParts = currentParsedUrl.slice(0, selectedIndex + 1);
            selectedUrl.textContent = selectedParts.join('/');
        } else {
            selectedUrl.textContent = '';
        }
    }

    // 選択されたサイトを追加する関数
    async function addSelectedSite() {
        if (selectedIndex < 0 || !currentParsedUrl) {
            showMessage('ブロック範囲を選択してください', 'error');
            return;
        }

        const selectedParts = currentParsedUrl.slice(0, selectedIndex + 1);
        const siteToAdd = selectedParts.join('/');

        try {
            // 既存のブロックリストを取得
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];

            // 重複チェック
            if (blockedSites.includes(siteToAdd)) {
                showMessage('このサイトは既にブロックされています', 'error');
                return;
            }

            // 新しいサイトを追加
            blockedSites.push(siteToAdd);
            await chrome.storage.local.set({ blockedSites });

            // セクションをクリア
            urlAnalysisSection.style.display = 'none';
            currentParsedUrl = null;
            selectedIndex = -1;

            // ブロック中のサイト数を更新
            await updateBlockedSitesCount();
            await updateBlockStatus();
            
            showMessage('ブロック対象に追加しました: ' + siteToAdd);
            
            // 現在のサイトがブロック対象になった場合、即座にブロック画面にリダイレクト
            if (currentUrl && currentTabId && isUrlBlocked(currentUrl, siteToAdd)) {
                console.log('Current site matches new block rule, redirecting...');
                const blockUrl = chrome.runtime.getURL('block.html') + '?blocked=' + encodeURIComponent(currentUrl);
                try {
                    // 少し遅延を入れてから確実にリダイレクト
                    setTimeout(async () => {
                        try {
                            await chrome.tabs.update(currentTabId, { url: blockUrl });
                            window.close(); // ポップアップを閉じる
                        } catch (redirectError) {
                            console.error('Error redirecting to block page:', redirectError);
                        }
                    }, 100);
                } catch (error) {
                    console.error('Error setting up redirect:', error);
                }
            }
            
        } catch (error) {
            console.error('Error adding site:', error);
            showMessage('サイトの追加に失敗しました', 'error');
        }
    }

    // 現在のサイトのブロック状況を更新する関数
    async function updateBlockStatus() {
        try {
            if (!currentUrl) return;
            
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];
            
            // 現在のURLにマッチするすべてのブロックルールを見つける
            const matchingSites = blockedSites.filter(blockedSite => {
                return isUrlBlocked(currentUrl, blockedSite);
            });
            
            if (matchingSites.length > 0) {
                // 最も具体的なルール（最も長いパス）を表示用として選択
                const mostSpecificRule = matchingSites.reduce((prev, current) => {
                    const prevParts = prev.split('/').length;
                    const currentParts = current.split('/').length;
                    
                    if (currentParts > prevParts) {
                        return current;
                    } else if (currentParts === prevParts) {
                        return current.length > prev.length ? current : prev;
                    } else {
                        return prev;
                    }
                });
                
                blockedRuleName.textContent = mostSpecificRule;
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

    // URLブロック判定関数（background.jsと同じロジック）
    function isUrlBlocked(currentUrl, blockedSite) {
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

    // 現在のサイトをブロックリストから削除する関数
    async function removeCurrentSiteFromBlocklist() {
        try {
            if (!currentUrl) return;
            
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];

            // 現在のURLにマッチするすべてのブロックルールを見つける
            const matchingSites = blockedSites.filter(blockedSite => {
                return isUrlBlocked(currentUrl, blockedSite);
            });

            if (matchingSites.length === 0) {
                showMessage('ブロック対象が見つかりませんでした', 'error');
                return;
            }

            // 最も具体的なルール（最も長いパス）を優先して削除
            // パス数で比較し、同じ場合は文字列長で比較
            const mostSpecificSite = matchingSites.reduce((prev, current) => {
                const prevParts = prev.split('/').length;
                const currentParts = current.split('/').length;
                
                if (currentParts > prevParts) {
                    return current;
                } else if (currentParts === prevParts) {
                    return current.length > prev.length ? current : prev;
                } else {
                    return prev;
                }
            });

            const updatedSites = blockedSites.filter(site => site !== mostSpecificSite);
            await chrome.storage.local.set({ blockedSites: updatedSites });
            
            await updateBlockStatus();
            await updateBlockedSitesCount();
            
            showMessage(`${mostSpecificSite} のブロックを解除しました`);
            
        } catch (error) {
            console.error('Error removing site from blocklist:', error);
            showMessage('エラーが発生しました', 'error');
        }
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