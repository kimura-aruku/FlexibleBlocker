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
        analyzeUrl(currentUrl);
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

    // URLを解析する関数
    function analyzeUrl(url) {
        analyzeUrlWithUI(
            url,
            urlParts,
            selectedUrl,
            // 単一パートの場合
            (singleUrl) => {
                addSiteDirectly(singleUrl);
            },
            // 複数パーツ表示時
            () => {
                blockCurrentSiteBtn.style.display = 'none';
                urlAnalysisSection.style.display = 'block';
            },
            // エラーの場合
            (error) => {
                console.error('URL parsing error:', error);
                showTemporaryMessage('URLの解析に失敗しました', 'error');
            },
            // 空URL時
            () => {
                showTemporaryMessage('URLが取得できませんでした', 'error');
            }
        );
    }

    // サイトを直接追加する関数
    async function addSiteDirectly(siteToAdd) {
        const fromTimeValue = simpleFromTime.value || '00:00';
        const toTimeValue = simpleToTime.value || '23:59';
        const siteInfo = {
            url: siteToAdd,
            fromTime: fromTimeValue,
            toTime: toTimeValue
        };

        await addSiteWithCallback(
            siteInfo,
            // 成功時
            async (addedSite) => {
                await updateBlockStatus();
                
                // 現在のサイトがブロック対象になった場合、即座にブロック画面にリダイレクト
                if (currentUrl && currentTabId && isUrlBlocked(currentUrl, addedSite)) {
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
            },
            // エラー時
            (error) => {
                console.error('Error adding site:', error);
                showTemporaryMessage(error.message, 'error');
            }
        );
    }



    // 選択されたサイトを追加する関数
    async function addSelectedSite() {
        const fromTimeValue = simpleFromTime.value || '00:00';
        const toTimeValue = simpleToTime.value || '23:59';

        await addSelectedSiteWithCallback(
            window.currentParsedUrl,
            fromTimeValue,
            toTimeValue,
            // 成功時
            async (addedSite) => {
                // セクションをクリア
                urlAnalysisSection.style.display = 'none';
                // ボタンを再表示
                blockCurrentSiteBtn.style.display = 'block';
                window.currentParsedUrl = null;
                window.selectedIndex = -1;

                await updateBlockStatus();
                
                // 現在のサイトがブロック対象になった場合、即座にブロック画面にリダイレクト
                if (currentUrl && currentTabId && isUrlBlocked(currentUrl, addedSite)) {
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
            },
            // エラー時
            (error) => {
                console.error('Error adding site:', error);
                showTemporaryMessage(error.message, 'error');
            },
            // 選択なしの場合
            () => {
                shakeUrlParts();
            }
        );
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


});