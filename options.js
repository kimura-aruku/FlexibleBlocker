// オプションページの JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const siteInput = document.getElementById('siteInput');
    const analyzeUrlBtn = document.getElementById('analyzeUrlBtn');
    const addSelectedBtn = document.getElementById('addSelectedBtn');
    const blockedSitesList = document.getElementById('blockedSitesList');
    const noSitesMessage = document.getElementById('noSitesMessage');
    const urlAnalysisSection = document.getElementById('urlAnalysisSection');
    const urlParts = document.getElementById('urlParts');
    const selectedUrl = document.getElementById('selectedUrl');
    const fromTime = document.getElementById('fromTime');
    const toTime = document.getElementById('toTime');
    const directFromTime = document.getElementById('directFromTime');
    const directToTime = document.getElementById('directToTime');

    window.selectedIndex = -1;

    // ページ読み込み時にブロックされたサイト一覧を表示
    loadBlockedSites();

    // URL解析ボタンのクリックイベント
    analyzeUrlBtn.addEventListener('click', () => {
        analyzeUrl(siteInput.value.trim());
    });
    
    // 選択されたURLを追加
    addSelectedBtn.addEventListener('click', addSelectedSite);
    
    // Enterキーでも解析できるようにする
    siteInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            analyzeUrl(siteInput.value.trim());
        }
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
                urlAnalysisSection.style.display = 'block';
            },
            // エラーの場合
            (error) => {
                console.error('URL parsing error:', error);
                alert('有効なURLを入力してください');
            },
            // 空URL時
            () => {
                alert('URLを入力してください');
            }
        );
    }

    // サイトを直接追加する関数
    async function addSiteDirectly(siteToAdd) {
        const fromTimeValue = directFromTime.value || '00:00';
        const toTimeValue = directToTime.value || '23:59';
        const siteInfo = {
            url: siteToAdd,
            fromTime: fromTimeValue,
            toTime: toTimeValue
        };

        await addSiteWithCallback(
            siteInfo,
            // 成功時
            (addedSite) => {
                // 入力フィールドをクリア
                siteInput.value = '';
                // リストを再読み込み
                loadBlockedSites();
            },
            // エラー時
            (error) => {
                console.error('Error adding site:', error);
                alert(error.message);
            }
        );
    }



    // 選択されたサイトを追加する関数
    async function addSelectedSite() {
        const fromTimeValue = directFromTime.value || '00:00';
        const toTimeValue = directToTime.value || '23:59';

        await addSelectedSiteWithCallback(
            window.currentParsedUrl,
            fromTimeValue,
            toTimeValue,
            // 成功時
            (addedSite) => {
                // 入力フィールドとセクションをクリア
                siteInput.value = '';
                urlAnalysisSection.style.display = 'none';
                window.currentParsedUrl = null;
                window.selectedIndex = -1;

                // リストを再読み込み
                loadBlockedSites();
            },
            // エラー時
            (error) => {
                console.error('Error adding site:', error);
                alert(error.message);
            },
            // 選択なしの場合
            () => {
                shakeUrlParts();
            }
        );
    }

    // ブロックされたサイト一覧を読み込む関数
    async function loadBlockedSites() {
        try {
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];
            const sitesTable = document.getElementById('blockedSitesTable');
            const blockedSitesCountElement = document.getElementById('blockedSitesCount');

            // ブロック中のサイト数を更新
            blockedSitesCountElement.textContent = blockedSites.length;

            if (blockedSites.length === 0) {
                blockedSitesList.innerHTML = '';
                noSitesMessage.style.display = 'block';
                sitesTable.style.display = 'none';
                return;
            }

            noSitesMessage.style.display = 'none';
            sitesTable.style.display = 'table';
            blockedSitesList.innerHTML = '';

            blockedSites.forEach(site => {
                const siteElement = createSiteTableRow(site);
                blockedSitesList.appendChild(siteElement);
            });

            // ツールチップの位置設定
            setupTooltips();
        } catch (error) {
            console.error('Error loading blocked sites:', error);
        }
    }

    // ツールチップの位置設定関数
    function setupTooltips() {
        const urlCells = document.querySelectorAll('.url-cell');
        
        urlCells.forEach(cell => {
            const tooltip = cell.querySelector('.url-tooltip');
            if (!tooltip) return;

            cell.addEventListener('mouseenter', function(e) {
                const rect = cell.getBoundingClientRect();
                tooltip.style.left = rect.left + 'px';
                tooltip.style.top = (rect.top - 10) + 'px';
                tooltip.style.transform = 'translateY(-100%)';
            });
        });
    }

    // サイトテーブル行を作成する関数
    function createSiteTableRow(siteInfo) {
        const tr = document.createElement('tr');
        
        const url = typeof siteInfo === 'string' ? siteInfo : siteInfo.url;
        const fromTime = siteInfo.fromTime || '00:00';
        const toTime = siteInfo.toTime || '23:59';
        
        tr.innerHTML = `
            <td class="url-cell">
                ${url}
                <div class="url-tooltip">${url}</div>
            </td>
            <td class="time-cell">
                <div class="time-edit-container">
                    <input type="time" class="time-from-input" value="${fromTime}" data-site="${url}">
                    <span class="time-separator">～</span>
                    <input type="time" class="time-to-input" value="${toTime}" data-site="${url}">
                </div>
            </td>
            <td class="action-cell">
                <button class="remove-btn" data-site="${url}">削除</button>
            </td>
        `;

        // 時間変更のイベントリスナー
        const fromInput = tr.querySelector('.time-from-input');
        const toInput = tr.querySelector('.time-to-input');
        
        fromInput.addEventListener('change', () => updateSiteTime(url, fromInput.value, toInput.value));
        toInput.addEventListener('change', () => updateSiteTime(url, fromInput.value, toInput.value));

        // 削除ボタンのイベントリスナー
        const removeBtn = tr.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => removeSite(url));

        return tr;
    }

    // サイトの時間帯を更新する関数
    async function updateSiteTime(siteUrl, newFromTime, newToTime) {
        try {
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];
            
            // 該当サイトを見つけて時間帯を更新
            const updatedSites = blockedSites.map(site => {
                const url = typeof site === 'string' ? site : site.url;
                if (url === siteUrl) {
                    return {
                        url: siteUrl,
                        fromTime: newFromTime,
                        toTime: newToTime
                    };
                }
                return site;
            });
            
            await chrome.storage.local.set({ blockedSites: updatedSites });
            console.log(`Updated time range for ${siteUrl}: ${newFromTime}-${newToTime}`);
            
        } catch (error) {
            console.error('Error updating site time:', error);
            alert('時間帯の更新に失敗しました');
        }
    }

    // サイトを削除する関数
    async function removeSite(siteToRemove) {
        try {
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];
            
            const updatedSites = blockedSites.filter(site => {
                const url = typeof site === 'string' ? site : site.url;
                return url !== siteToRemove;
            });
            await chrome.storage.local.set({ blockedSites: updatedSites });
            
            loadBlockedSites();
        } catch (error) {
            console.error('Error removing site:', error);
            alert('サイトの削除に失敗しました');
        }
    }

});