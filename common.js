// FlexibleBlocker 共通関数ライブラリ

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
function displayUrlParts(urlParts, currentParsedUrl, updateSelectedUrlCallback) {
    urlParts.innerHTML = '';
    
    // 注意メッセージを赤色にする（初期状態）
    const noteElement = document.querySelector('#urlAnalysisSection .note');
    if (noteElement) {
        noteElement.classList.add('warning');
    }

    currentParsedUrl.forEach((part, index) => {
        const partElement = document.createElement('span');
        partElement.className = 'url-part';
        partElement.textContent = part;
        partElement.dataset.index = index;
        
        partElement.addEventListener('click', () => selectUrlPart(index, updateSelectedUrlCallback));
        
        urlParts.appendChild(partElement);
        
        // / 区切り文字を追加（最後以外）
        if (index < currentParsedUrl.length - 1) {
            const separator = document.createElement('span');
            separator.className = 'url-separator';
            separator.textContent = '/';
            urlParts.appendChild(separator);
        }
    });

    if (updateSelectedUrlCallback) {
        updateSelectedUrlCallback();
    }
}

// URL部分を選択する関数
function selectUrlPart(index, updateSelectedUrlCallback) {
    // 既に選択されている部分をクリックした場合は、その部分より前まで選択
    if (window.selectedIndex === index) {
        if (index === 0) {
            // 最初の部分をクリックした場合は全て非選択
            window.selectedIndex = -1;
            
            // 注意メッセージの赤色を復活
            const noteElement = document.querySelector('#urlAnalysisSection .note');
            if (noteElement) {
                noteElement.classList.add('warning');
            }
            
            // 全ての部分の選択を解除
            document.querySelectorAll('.url-part').forEach(element => {
                element.classList.remove('selected');
            });
        } else {
            // 前の部分まで選択状態にする
            window.selectedIndex = index - 1;
            
            // 全ての部分のスタイルをリセット
            document.querySelectorAll('.url-part').forEach((element, i) => {
                if (i <= window.selectedIndex) {
                    element.classList.add('selected');
                } else {
                    element.classList.remove('selected');
                }
            });
        }
    } else {
        window.selectedIndex = index;
        
        // 選択されたので注意メッセージの赤色を解除
        const noteElement = document.querySelector('#urlAnalysisSection .note');
        if (noteElement) {
            noteElement.classList.remove('warning');
        }
        
        // 全ての部分のスタイルをリセット
        document.querySelectorAll('.url-part').forEach((element, i) => {
            if (i <= index) {
                element.classList.add('selected');
            } else {
                element.classList.remove('selected');
            }
        });
    }

    if (updateSelectedUrlCallback) {
        updateSelectedUrlCallback();
    }
}

// 選択されたURLを更新する関数
function updateSelectedUrl(selectedUrl, currentParsedUrl) {
    if (window.selectedIndex >= 0 && currentParsedUrl) {
        const selectedParts = currentParsedUrl.slice(0, window.selectedIndex + 1);
        selectedUrl.textContent = selectedParts.join('/');
    } else {
        selectedUrl.textContent = '';
    }
}

// URLブロック判定関数（時間を考慮せずにマッチするか）
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

// URLブロック判定関数（時間も考慮）
function isUrlBlocked(currentUrl, siteInfo) {
    if (!isUrlMatchedIgnoreTime(currentUrl, siteInfo)) {
        return false;
    }
    
    // URLマッチした場合、時間帯をチェック
    return isCurrentTimeBlocked(siteInfo.fromTime, siteInfo.toTime);
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

// ===== コールバック方式の共通関数 =====

// URL解析と処理の共通関数
function analyzeUrlWithCallback(url, onSinglePart, onMultipleParts, onError) {
    try {
        const parsedUrl = parseUrl(url);
        if (parsedUrl.length === 1) {
            onSinglePart(parsedUrl[0]);
        } else {
            onMultipleParts(parsedUrl);
        }
    } catch (error) {
        onError(error);
    }
}

// URL部分表示の共通関数
function displayUrlPartsWithCallback(urlPartsElement, parsedUrl, updateCallback, onShow) {
    window.selectedIndex = -1;
    displayUrlParts(urlPartsElement, parsedUrl, updateCallback);
    if (onShow) onShow();
}

// サイト追加の共通関数
async function addSiteWithCallback(siteInfo, onSuccess, onError) {
    try {
        const result = await chrome.storage.local.get(['blockedSites']);
        const blockedSites = result.blockedSites || [];
        
        // 重複チェック
        if (blockedSites.some(site => site.url === siteInfo.url)) {
            onError(new Error('このサイトは既にブロックされています'));
            return;
        }
        
        // 新しいサイトを追加
        blockedSites.push(siteInfo);
        await chrome.storage.local.set({ blockedSites });
        onSuccess(siteInfo);
    } catch (error) {
        onError(error);
    }
}

// 選択されたサイト追加の共通関数
async function addSelectedSiteWithCallback(
    currentParsedUrl,
    fromTimeValue,
    toTimeValue,
    onSuccess,
    onError,
    onNoSelection
) {
    if (window.selectedIndex < 0 || !currentParsedUrl) {
        onNoSelection();
        return;
    }
    
    const selectedParts = currentParsedUrl.slice(0, window.selectedIndex + 1);
    const siteToAdd = selectedParts.join('/');
    
    const siteInfo = {
        url: siteToAdd,
        fromTime: fromTimeValue,
        toTime: toTimeValue
    };
    
    await addSiteWithCallback(siteInfo, onSuccess, onError);
}

// 一時メッセージ表示の共通関数
function showTemporaryMessage(message, type = 'success', customStyle = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    const defaultStyle = `
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
    
    messageDiv.style.cssText = customStyle || defaultStyle;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 2000);
}

// URLパーツ振動エフェクトの共通関数
function shakeUrlParts() {
    document.querySelectorAll('.url-part').forEach(part => {
        part.classList.add('shake');
    });
    
    setTimeout(() => {
        document.querySelectorAll('.url-part').forEach(part => {
            part.classList.remove('shake');
        });
    }, 500);
}

// URL解析の共通関数（UI要素とコールバック付き）
function analyzeUrlWithUI(
    url,
    urlPartsElement,
    selectedUrlElement,
    onSinglePartSuccess,
    onMultiplePartsShow,
    onError,
    onEmptyUrl
) {
    if (!url) {
        onEmptyUrl();
        return;
    }

    analyzeUrlWithCallback(
        url,
        // 単一パートの場合
        onSinglePartSuccess,
        // 複数パートの場合
        (parsedUrl) => {
            window.currentParsedUrl = parsedUrl;
            displayUrlPartsWithCallback(
                urlPartsElement,
                parsedUrl,
                () => updateSelectedUrl(selectedUrlElement, parsedUrl),
                onMultiplePartsShow
            );
        },
        // エラーの場合
        onError
    );
}