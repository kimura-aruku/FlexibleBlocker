// ポップアップの JavaScript
document.addEventListener('DOMContentLoaded', async function() {
    const notBlockedState = document.getElementById('notBlockedState');
    const blockCurrentSiteBtn = document.getElementById('blockCurrentSiteBtn');
    const openOptionsBtn = document.getElementById('openOptionsBtn');
    const blockedSitesCount = document.getElementById('count');
    const urlAnalysisSection = document.getElementById('urlAnalysisSection');
    const urlParts = document.getElementById('urlParts');
    const selectedUrl = document.getElementById('selectedUrl');
    const addSelectedBtn = document.getElementById('addSelectedBtn');
    const cancelAnalysisBtn = document.getElementById('cancelAnalysisBtn');
    const simpleFromTime = document.getElementById('simpleFromTime');
    const simpleToTime = document.getElementById('simpleToTime');

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


    // 選択されたURLを追加
    addSelectedBtn.addEventListener('click', addSelectedSite);
    
    // キャンセルボタン
    cancelAnalysisBtn.addEventListener('click', function() {
        urlAnalysisSection.style.display = 'none';
        // ボタンを再表示
        blockCurrentSiteBtn.style.display = 'block';
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
            
            // 単一パート（ドメインのみ）の場合は即座にブロック
            if (currentParsedUrl.length === 1) {
                addSiteDirectly(currentParsedUrl[0]);
                return;
            }
            
            // 複数パートがある場合のみ選択画面を表示
            displayUrlParts();
            // ボタンのみ非表示にして時間帯入力は表示したまま
            blockCurrentSiteBtn.style.display = 'none';
            urlAnalysisSection.style.display = 'block';
        } catch (error) {
            console.error('URL parsing error:', error);
            showMessage('URLの解析に失敗しました', 'error');
        }
    }

    // サイトを直接追加する関数
    async function addSiteDirectly(siteToAdd) {
        try {
            // 既存のブロックリストを取得
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];

            // シンプル時間入力フィールドから値を取得
            const fromTimeValue = simpleFromTime.value || '00:00';
            const toTimeValue = simpleToTime.value || '23:59';

            // サイト情報オブジェクトを作成
            const siteInfo = {
                url: siteToAdd,
                fromTime: fromTimeValue,
                toTime: toTimeValue
            };

            // 重複チェック（URLでチェック）
            if (blockedSites.some(site => site.url === siteToAdd)) {
                showMessage('このサイトは既にブロックされています', 'error');
                return;
            }

            // 新しいサイトを追加
            blockedSites.push(siteInfo);
            await chrome.storage.local.set({ blockedSites });

            // ブロック中のサイト数を更新
            await updateBlockedSitesCount();
            await updateBlockStatus();
            
            // 現在のサイトがブロック対象になった場合、即座にブロック画面にリダイレクト
            if (currentUrl && currentTabId && isUrlBlocked(currentUrl, siteInfo)) {
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

            // 時間帯情報を取得（上部のシンプル時間入力フィールドから）
            const fromTimeValue = simpleFromTime.value || '00:00';
            const toTimeValue = simpleToTime.value || '23:59';

            // サイト情報オブジェクトを作成
            const siteInfo = {
                url: siteToAdd,
                fromTime: fromTimeValue,
                toTime: toTimeValue
            };

            // 重複チェック（URLでチェック）
            if (blockedSites.some(site => site.url === siteToAdd)) {
                showMessage('このサイトは既にブロックされています', 'error');
                return;
            }

            // 新しいサイトを追加
            blockedSites.push(siteInfo);
            await chrome.storage.local.set({ blockedSites });

            // セクションをクリア
            urlAnalysisSection.style.display = 'none';
            // ボタンを再表示
            blockCurrentSiteBtn.style.display = 'block';
            currentParsedUrl = null;
            selectedIndex = -1;

            // ブロック中のサイト数を更新
            await updateBlockedSitesCount();
            await updateBlockStatus();
            
            // 現在のサイトがブロック対象になった場合、即座にブロック画面にリダイレクト
            if (currentUrl && currentTabId && isUrlBlocked(currentUrl, siteInfo)) {
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
            
            // 現在のURLにマッチするすべてのブロックルールを見つける（時間を考慮せず）
            const matchingSitesIgnoreTime = blockedSites.filter(blockedSite => {
                return isUrlMatchedIgnoreTime(currentUrl, blockedSite);
            });
            
            if (matchingSitesIgnoreTime.length > 0) {
                // ブロック設定済み - ボタン無効化して設定済み時間を表示
                const mostSpecificRule = matchingSitesIgnoreTime.reduce((prev, current) => {
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
                
                blockCurrentSiteBtn.disabled = true;
                blockCurrentSiteBtn.textContent = 'ブロック設定済み';
                
                // 時間入力フィールドに設定済み時間を表示して無効化
                simpleFromTime.value = mostSpecificRule.fromTime;
                simpleToTime.value = mostSpecificRule.toTime;
                simpleFromTime.disabled = true;
                simpleToTime.disabled = true;
            } else {
                // ブロック設定なし - 通常状態
                blockCurrentSiteBtn.disabled = false;
                blockCurrentSiteBtn.textContent = 'このサイトをブロック';
                
                // 時間入力フィールドを有効化
                simpleFromTime.disabled = false;
                simpleToTime.disabled = false;
            }
            
            notBlockedState.style.display = 'block';
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
            
            // URLマッチした場合、時間帯をチェック
            return isCurrentTimeBlocked(siteInfo.fromTime, siteInfo.toTime);
            
        } catch (error) {
            console.error('Error checking URL:', error);
            return false;
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

    // URLが時間を考慮せずにブロック対象かチェックする関数
    function isUrlMatchedIgnoreTime(currentUrl, siteInfo) {
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
                return true; // ドメインが一致すればマッチ
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
            
            // URLマッチした
            return true;
            
        } catch (error) {
            console.error('Error checking URL:', error);
            return false;
        }
    }
});