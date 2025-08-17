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

    let currentParsedUrl = null;
    window.selectedIndex = -1;

    // ページ読み込み時にブロックされたサイト一覧を表示
    loadBlockedSites();

    // URL解析ボタンのクリックイベント
    analyzeUrlBtn.addEventListener('click', analyzeUrl);
    
    // 選択されたURLを追加
    addSelectedBtn.addEventListener('click', addSelectedSite);
    
    // Enterキーでも解析できるようにする
    siteInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            analyzeUrl();
        }
    });

    // URLを解析する関数
    function analyzeUrl() {
        const url = siteInput.value.trim();
        
        if (!url) {
            alert('URLを入力してください');
            return;
        }

        try {
            currentParsedUrl = parseUrl(url);
            
            // 単一パート（ドメインのみ）の場合は即座にブロック
            if (currentParsedUrl.length === 1) {
                addSiteDirectly(currentParsedUrl[0]);
                return;
            }
            
            // 複数パートがある場合のみ選択画面を表示
            displayUrlPartsLocal();
            urlAnalysisSection.style.display = 'block';
        } catch (error) {
            console.error('URL parsing error:', error);
            alert('有効なURLを入力してください');
        }
    }

    // サイトを直接追加する関数
    async function addSiteDirectly(siteToAdd) {
        try {
            // 既存のブロックリストを取得
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];

            // 直接時間入力フィールドから値を取得
            const fromTimeValue = directFromTime.value || '00:00';
            const toTimeValue = directToTime.value || '23:59';

            // サイト情報オブジェクトを作成
            const siteInfo = {
                url: siteToAdd,
                fromTime: fromTimeValue,
                toTime: toTimeValue
            };

            // 重複チェック（URLでチェック）
            if (blockedSites.some(site => site.url === siteToAdd)) {
                alert('このサイトは既にブロックされています');
                return;
            }

            // 新しいサイトを追加
            blockedSites.push(siteInfo);
            await chrome.storage.local.set({ blockedSites });

            // 入力フィールドをクリア
            siteInput.value = '';

            // リストを再読み込み
            loadBlockedSites();
            
        } catch (error) {
            console.error('Error adding site:', error);
            alert('サイトの追加に失敗しました');
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

            // 時間帯情報を取得（上部の直接時間入力フィールドから）
            const fromTimeValue = directFromTime.value || '00:00';
            const toTimeValue = directToTime.value || '23:59';

            // サイト情報オブジェクトを作成
            const siteInfo = {
                url: siteToAdd,
                fromTime: fromTimeValue,
                toTime: toTimeValue
            };

            // 重複チェック（URLでチェック）
            if (blockedSites.some(site => site.url === siteToAdd)) {
                alert('このサイトは既にブロックされています');
                return;
            }

            // 新しいサイトを追加
            blockedSites.push(siteInfo);
            await chrome.storage.local.set({ blockedSites });

            // 入力フィールドとセクションをクリア
            siteInput.value = '';
            urlAnalysisSection.style.display = 'none';
            currentParsedUrl = null;
            window.selectedIndex = -1;

            // リストを再読み込み
            loadBlockedSites();
            
        } catch (error) {
            console.error('Error adding site:', error);
            alert('サイトの追加に失敗しました');
        }
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