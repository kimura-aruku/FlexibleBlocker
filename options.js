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

    let currentParsedUrl = null;
    let selectedIndex = -1;

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
            displayUrlParts();
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

            // サイト情報オブジェクトを作成
            const siteInfo = {
                url: siteToAdd,
                fromTime: '00:00',
                toTime: '23:59'
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
            alert('ブロック範囲を選択してください');
            return;
        }

        const selectedParts = currentParsedUrl.slice(0, selectedIndex + 1);
        const siteToAdd = selectedParts.join('/');

        try {
            // 既存のブロックリストを取得
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];

            // 時間帯情報を取得
            const fromTimeValue = fromTime.value || '00:00';
            const toTimeValue = toTime.value || '23:59';

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
            selectedIndex = -1;

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

            if (blockedSites.length === 0) {
                blockedSitesList.innerHTML = '';
                noSitesMessage.style.display = 'block';
                return;
            }

            noSitesMessage.style.display = 'none';
            blockedSitesList.innerHTML = '';

            blockedSites.forEach(site => {
                const siteElement = createSiteElement(site);
                blockedSitesList.appendChild(siteElement);
            });
        } catch (error) {
            console.error('Error loading blocked sites:', error);
        }
    }

    // サイト要素を作成する関数
    function createSiteElement(siteInfo) {
        const div = document.createElement('div');
        div.className = 'site-item';
        
        // 時間帯表示の決定
        let timeDisplay = '';
        if (siteInfo.fromTime !== '00:00' || siteInfo.toTime !== '23:59') {
            timeDisplay = ` (${siteInfo.fromTime}-${siteInfo.toTime})`;
        }
        
        const url = typeof siteInfo === 'string' ? siteInfo : siteInfo.url;
        
        div.innerHTML = `
            <span class="site-name">${url}${timeDisplay}</span>
            <button class="remove-btn" data-site="${url}">削除</button>
        `;

        // 削除ボタンのイベントリスナー
        const removeBtn = div.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => removeSite(url));

        return div;
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