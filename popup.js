// ポップアップの JavaScript
document.addEventListener('DOMContentLoaded', async function() {
    const notBlockedState = document.getElementById('notBlockedState');
    const blockCurrentSiteBtn = document.getElementById('blockCurrentSiteBtn');
    const openOptionsBtn = document.getElementById('openOptionsBtn');
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
            } else {
                await updateBlockStatus();
            }
        }
    } catch (error) {
        console.error('Error getting current tab:', error);
    }


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
            displayUrlPartsLocal();
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


    // URL部分を表示する関数
    function displayUrlPartsLocal() {
        window.selectedIndex = -1;
        displayUrlParts(urlParts, currentParsedUrl, updateSelectedUrlLocal);
    }

    // 選択されたURLを更新する関数
    function updateSelectedUrlLocal() {
        updateSelectedUrl(selectedUrl, currentParsedUrl);
    }

    // 選択されたサイトを追加する関数
    async function addSelectedSite() {
        if (window.selectedIndex < 0 || !currentParsedUrl) {
            // すべてのURLパーツを揺らす
            document.querySelectorAll('.url-part').forEach(part => {
                part.classList.add('shake');
            });
            
            // アニメーション終了後にクラスを削除
            setTimeout(() => {
                document.querySelectorAll('.url-part').forEach(part => {
                    part.classList.remove('shake');
                });
            }, 500);
            
            return;
        }

        const selectedParts = currentParsedUrl.slice(0, window.selectedIndex + 1);
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