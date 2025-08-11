// オプションページの JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const siteInput = document.getElementById('siteInput');
    const addSiteBtn = document.getElementById('addSiteBtn');
    const blockedSitesList = document.getElementById('blockedSitesList');
    const noSitesMessage = document.getElementById('noSitesMessage');

    // ページ読み込み時にブロックされたサイト一覧を表示
    loadBlockedSites();

    // 追加ボタンのクリックイベント
    addSiteBtn.addEventListener('click', addSite);
    
    // Enterキーでも追加できるようにする
    siteInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addSite();
        }
    });

    // サイトを追加する関数
    async function addSite() {
        const site = siteInput.value.trim();
        
        if (!site) {
            alert('サイトのURLを入力してください');
            return;
        }

        // URLの正規化（http:// や www. を除去）
        const normalizedSite = normalizeSite(site);
        
        if (!isValidDomain(normalizedSite)) {
            alert('有効なドメイン名を入力してください');
            return;
        }

        try {
            // 既存のブロックリストを取得
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];

            // 重複チェック
            if (blockedSites.includes(normalizedSite)) {
                alert('このサイトは既にブロックされています');
                return;
            }

            // 新しいサイトを追加
            blockedSites.push(normalizedSite);
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
    function createSiteElement(site) {
        const div = document.createElement('div');
        div.className = 'site-item';
        
        div.innerHTML = `
            <span class="site-name">${site}</span>
            <button class="remove-btn" data-site="${site}">削除</button>
        `;

        // 削除ボタンのイベントリスナー
        const removeBtn = div.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => removeSite(site));

        return div;
    }

    // サイトを削除する関数
    async function removeSite(siteToRemove) {
        if (!confirm(`${siteToRemove} をブロックリストから削除しますか？`)) {
            return;
        }

        try {
            const result = await chrome.storage.local.get(['blockedSites']);
            const blockedSites = result.blockedSites || [];
            
            const updatedSites = blockedSites.filter(site => site !== siteToRemove);
            await chrome.storage.local.set({ blockedSites: updatedSites });
            
            loadBlockedSites();
        } catch (error) {
            console.error('Error removing site:', error);
            alert('サイトの削除に失敗しました');
        }
    }

    // URLを正規化する関数
    function normalizeSite(input) {
        let site = input.toLowerCase();
        
        // http:// や https:// を除去
        site = site.replace(/^https?:\/\//, '');
        
        // www. を除去
        site = site.replace(/^www\./, '');
        
        // パス部分を除去
        site = site.split('/')[0];
        
        return site;
    }

    // ドメイン名の妥当性をチェックする関数
    function isValidDomain(domain) {
        // 簡単なドメイン名の正規表現チェック
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.([a-zA-Z]{2,}|[a-zA-Z]{2,}\.[a-zA-Z]{2,})$/;
        return domainRegex.test(domain) || domain === 'localhost';
    }
});