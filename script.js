// ============================================================
//  MOUSE AI IPTV Pro v4.0 - Full Application
//  Complete working version with proxy support
// ============================================================

(function() {
    'use strict';

    // ===== CONSTANTS =====
    const APP_NAME = 'MOUSE AI IPTV';
    const APP_VERSION = '4.0.0 ULTIMATE';
    const STORAGE_KEY = 'mouse_ai_settings_v4';
    const FAV_KEY = 'mouse_ai_favorites_v4';
    const SERVERS_KEY = 'mouse_ai_servers_v4';
    const HISTORY_KEY = 'mouse_ai_history_v4';

    // ===== STATE =====
    let state = {
        channels: [],
        filtered: [],
        favorites: new Set(),
        customServers: {},
        settings: { volume: 100, muteOnStart: false, autoLoad: false, showServerInfo: true, timeout: 30 },
        currentIndex: -1,
        isPlaying: false,
        isMuted: false,
        isFullscreen: false,
        loading: false,
        favView: false,
        currentGroup: 'All Groups',
        searchQuery: '',
        videoLoaded: false,
        currentChannelUrl: '',
        useProxy: true // Enable proxy for CORS
    };

    // ===== DOM REFS =====
    const video = document.getElementById('videoPlayer');
    const videoContainer = document.getElementById('videoContainer');
    const placeholder = document.getElementById('videoPlaceholder');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const serverInfo = document.getElementById('serverInfo');
    const progressSlider = document.getElementById('progressSlider');
    const playBtn = document.getElementById('playBtn');
    const stopBtn = document.getElementById('stopBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const muteBtn = document.getElementById('muteBtn');
    const volSlider = document.getElementById('volSlider');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const infoLabel = document.getElementById('infoLabel');
    const serverSelect = document.getElementById('serverSelect');
    const loadBtn = document.getElementById('loadBtn');
    const fileBtn = document.getElementById('fileBtn');
    const addCodeBtn = document.getElementById('addCodeBtn');
    const manageBtn = document.getElementById('manageBtn');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const statusLabel = document.getElementById('statusLabel');
    const groupSelect = document.getElementById('groupSelect');
    const searchInput = document.getElementById('searchInput');
    const channelList = document.getElementById('channelList');
    const countLabel = document.getElementById('countLabel');
    const favBtn = document.getElementById('favBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const toast = document.getElementById('toast');

    // ===== PROXY URL =====
    // Use your own proxy server or this free one
    const PROXY_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? '/proxy?url=' 
        : 'https://cors-anywhere.herokuapp.com/';

    // ===== STORAGE =====
    function loadData() {
        try {
            const s = localStorage.getItem(STORAGE_KEY);
            if (s) state.settings = { ...state.settings, ...JSON.parse(s) };
        } catch (e) { console.warn('Settings load error', e); }

        try {
            const f = localStorage.getItem(FAV_KEY);
            if (f) state.favorites = new Set(JSON.parse(f));
        } catch (e) { console.warn('Favorites load error', e); }

        try {
            const c = localStorage.getItem(SERVERS_KEY);
            if (c) {
                state.customServers = JSON.parse(c);
            } else {
                // Add sample server for testing
                state.customServers = {
                    '🎯 القناة الإسلامية (تجريبي)': {
                        url: 'http://line.watchtivo-8k.com:80/play/live.php?mac=A0:BB:3E:18:9E:02&stream=686148&extension=ts',
                        info: { type: 'test', host: 'WatchTivo' }
                    }
                };
                saveServers();
            }
        } catch (e) {
            console.warn('Servers load error', e);
            state.customServers = {};
            saveServers();
        }

        try {
            const h = localStorage.getItem(HISTORY_KEY);
            if (h) state.history = JSON.parse(h);
        } catch (e) { console.warn('History load error', e); }
    }

    function saveSettings() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings)); } catch (e) {}
    }

    function saveFavorites() {
        try { localStorage.setItem(FAV_KEY, JSON.stringify([...state.favorites])); } catch (e) {}
    }

    function saveServers() {
        try { localStorage.setItem(SERVERS_KEY, JSON.stringify(state.customServers)); } catch (e) {}
    }

    function saveHistory() {
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(-50))); } catch (e) {}
    }

    // ===== TOAST =====
    let toastTimeout = null;

    function showToast(msg, type = 'success') {
        toast.textContent = msg;
        toast.className = 'toast ' + type;
        clearTimeout(toastTimeout);
        void toast.offsetWidth;
        toast.classList.add('show');
        toastTimeout = setTimeout(() => toast.classList.remove('show'), 4000);
    }

    // ===== PARSER =====
    function parseM3U(content) {
        const lines = content.split(/\r?\n/);
        const channels = [];
        let current = {};
        
        for (const raw of lines) {
            const line = raw.trim();
            if (!line) continue;
            
            if (line.startsWith('#EXTINF:')) {
                let name = 'Unnamed';
                const nameMatch = line.match(/#EXTINF:[^,]*,\s*(.+?)\s*$/);
                if (nameMatch) name = nameMatch[1].trim();
                
                let logo = '';
                const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                if (logoMatch) logo = logoMatch[1];
                
                let group = 'General';
                const groupMatch = line.match(/group-title="([^"]*)"/);
                if (groupMatch) group = groupMatch[1];
                
                current = { name, logo, group, url: '' };
            } else if ((line.startsWith('http://') || line.startsWith('https://')) && current && !current.url) {
                current.url = line;
                channels.push({ ...current });
                current = {};
            }
        }
        
        // Handle URLs without #EXTINF
        for (const line of lines) {
            const trimmed = line.trim();
            if ((trimmed.startsWith('http://') || trimmed.startsWith('https://')) && 
                !channels.some(c => c.url === trimmed)) {
                channels.push({ 
                    name: 'قناة ' + (channels.length + 1), 
                    url: trimmed, 
                    group: 'General', 
                    logo: '' 
                });
            }
        }
        
        return channels.filter(c => c.url);
    }

    function parseCode(text) {
        text = text.trim();
        if (!text) return { type: 'empty', data: {} };

        // Xtream
        let m = text.match(/(https?:\/\/[^\/\s]+(?::\d+)?)(?:[^\s]*)\?.*username=([^&\s]+).*password=([^&\s]+)/i);
        if (m) {
            return { type: 'xtream', data: { host: m[1], username: m[2], password: m[3], raw: text } };
        }

        // CCcam
        m = text.match(/[Cc][:;]\s*(\S+)\s+(\d+)\s+(\S+)\s+(\S+)/);
        if (m) {
            return { type: 'cccam', data: { host: m[1], port: m[2], user: m[3], pass: m[4], raw: text } };
        }

        // Newcamd
        m = text.match(/[Nn][:;]\s*(\S+)\s+(\d+)\s+(\S+)\s+(\S+)/);
        if (m) {
            return { type: 'newcamd', data: { host: m[1], port: m[2], user: m[3], pass: m[4], raw: text } };
        }

        // MAC
        const macs = text.match(/[0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}/g);
        if (macs) {
            const host = text.match(/https?:\/\/[^\s<>"{}|^`\[\]]+/);
            return { type: 'mac', data: { macs, host: host ? host[0] : '', raw: text } };
        }

        // Portal / Stalker
        const portalMatch = text.match(/(https?:\/\/\S+?)(?:\/c\/|\/stalker_portal\/|\/portal\/|\/server\/|\/get\.php|\/player_api\.php)/i);
        if (portalMatch) {
            return { type: 'portal', data: { host: portalMatch[1].replace(/\/+$/, ''), raw: text } };
        }

        // M3U URL
        const m3uMatch = text.match(/(https?:\/\/\S+\.(?:m3u|m3u8)(?:\?\S+)?)/i);
        if (m3uMatch) {
            return { type: 'm3u_url', data: { url: m3uMatch[1], raw: text } };
        }

        // Generic URL
        const urlMatch = text.match(/https?:\/\/[^\s<>"{}|^`\[\]]+/);
        if (urlMatch) {
            return { type: 'generic', data: { host: urlMatch[0].replace(/[^a-zA-Z0-9_/:.-]$/, ''), raw: text } };
        }

        return { type: 'unknown', data: { raw: text } };
    }

    function buildXtreamUrl(host, user, pass, type = 'm3u_plus') {
        if (!host || !user || !pass) return '';
        return `${host.replace(/\/+$/, '')}/get.php?username=${user}&password=${pass}&type=${type}`;
    }

    // ===== LOAD CHANNELS =====
    function loadChannels(source) {
        if (state.loading) return;
        
        let url = source || serverSelect.value;

        if (!url || url === '' || url === '-- لا يوجد سيرفرات --') {
            showToast('❌ لا يوجد سيرفر. أضف سيرفر أولاً.', 'error');
            return;
        }

        // Check if it's a custom server entry
        if (state.customServers[url]) {
            const data = state.customServers[url];
            state.serverInfo = data.info || {};
            url = data.url;
        }

        if (!url || !url.startsWith('http')) {
            showToast('❌ رابط سيرفر غير صالح', 'error');
            return;
        }

        // Clear previous
        state.channels = [];
        state.filtered = [];
        state.currentIndex = -1;
        state.videoLoaded = false;
        video.pause();
        video.src = '';
        placeholder.style.display = 'block';
        updatePlayButton();
        
        state.loading = true;
        updateUIForLoading(true);
        progressBar.classList.add('active');
        progressFill.style.width = '0%';
        statusLabel.textContent = '🔄 جاري الاتصال بالسيرفر...';
        statusLabel.className = 'status-label';
        loadingOverlay.classList.add('active');

        const timeout = (state.settings.timeout || 30) * 1000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        // Use proxy for CORS if needed
        let fetchUrl = url;
        if (state.useProxy && !url.includes('cors-anywhere')) {
            // Try direct first, then proxy
        }

        fetch(fetchUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br'
            }
        })
        .then(res => {
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            progressFill.style.width = '40%';
            statusLabel.textContent = '📥 جاري قراءة البيانات...';
            return res.text();
        })
        .then(text => {
            progressFill.style.width = '60%';
            statusLabel.textContent = '🔍 جاري تحليل القنوات...';
            
            if (!text || text.length < 10) {
                throw new Error('استجابة فارغة من السيرفر');
            }
            
            const channels = parseM3U(text);
            progressFill.style.width = '90%';
            
            if (channels.length === 0) {
                throw new Error('لم يتم العثور على قنوات');
            }
            
            onChannelsLoaded(channels);
        })
        .catch(err => {
            clearTimeout(timeoutId);
            state.loading = false;
            updateUIForLoading(false);
            progressBar.classList.remove('active');
            loadingOverlay.classList.remove('active');
            
            let errorMsg = err.message;
            if (err.name === 'AbortError') {
                errorMsg = 'انتهت المهلة - السيرفر لم يستجب';
            } else if (err.message.includes('Failed to fetch')) {
                errorMsg = 'خطأ في الشبكة - تأكد من اتصال الإنترنت';
                // Try with proxy
                if (state.useProxy) {
                    showToast('🔄 محاولة عبر الوكيل...', 'success');
                    loadWithProxy(url);
                    return;
                }
            }
            statusLabel.textContent = '❌ خطأ: ' + errorMsg;
            statusLabel.className = 'status-label error';
            showToast('❌ ' + errorMsg, 'error');
            console.error('Load error:', err);
        });
    }

    function loadWithProxy(url) {
        const proxyUrl = PROXY_URL + encodeURIComponent(url);
        statusLabel.textContent = '🔄 جاري الاتصال عبر الوكيل...';
        
        fetch(proxyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            progressFill.style.width = '50%';
            statusLabel.textContent = '📥 جاري قراءة البيانات...';
            return res.text();
        })
        .then(text => {
            const channels = parseM3U(text);
            if (channels.length === 0) {
                throw new Error('لم يتم العثور على قنوات');
            }
            onChannelsLoaded(channels);
            showToast('✅ تم التحميل عبر الوكيل', 'success');
        })
        .catch(err => {
            state.loading = false;
            updateUIForLoading(false);
            progressBar.classList.remove('active');
            loadingOverlay.classList.remove('active');
            statusLabel.textContent = '❌ فشل التحميل: ' + err.message;
            statusLabel.className = 'status-label error';
            showToast('❌ فشل التحميل: ' + err.message, 'error');
        });
    }

    function onChannelsLoaded(channels) {
        state.channels = channels;
        state.filtered = [...channels];
        state.currentIndex = -1;
        state.loading = false;
        updateUIForLoading(false);
        progressBar.classList.remove('active');
        progressFill.style.width = '100%';
        loadingOverlay.classList.remove('active');

        // Update groups
        const groups = new Set();
        for (const ch of channels) {
            if (ch.group) groups.add(ch.group);
        }
        groupSelect.innerHTML = '<option value="All Groups">📂 كل المجموعات</option>';
        for (const g of [...groups].sort()) {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            groupSelect.appendChild(opt);
        }
        state.currentGroup = 'All Groups';
        groupSelect.value = 'All Groups';

        renderChannels();
        statusLabel.textContent = `✅ تم التحميل: ${channels.length} قناة`;
        statusLabel.className = 'status-label success';
        countLabel.textContent = `${channels.length} قناة`;
        showToast(`✅ تم تحميل ${channels.length} قناة`, 'success');

        if (state.settings.autoLoad && channels.length > 0) {
            setTimeout(() => {
                const firstItem = channelList.querySelector('.channel-item');
                if (firstItem) firstItem.click();
            }, 500);
        }
    }

    function updateUIForLoading(loading) {
        loadBtn.disabled = loading;
        fileBtn.disabled = loading;
        addCodeBtn.disabled = loading;
        manageBtn.disabled = loading;
        serverSelect.disabled = loading;
        searchInput.disabled = loading;
        if (loading) {
            loadBtn.innerHTML = '⏳ جاري التحميل...';
        } else {
            loadBtn.textContent = '📡 تحميل القنوات';
        }
    }

    // ===== RENDER CHANNELS =====
    function renderChannels() {
        const search = state.searchQuery.toLowerCase().trim();
        const group = state.currentGroup;
        const favOnly = state.favView;

        let filtered = state.channels;
        if (group !== 'All Groups') {
            filtered = filtered.filter(c => (c.group || 'General') === group);
        }
        if (search) {
            filtered = filtered.filter(c => (c.name || '').toLowerCase().includes(search));
        }
        if (favOnly) {
            filtered = filtered.filter(c => state.favorites.has(c.url));
        }
        state.filtered = filtered;

        channelList.innerHTML = '';
        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'text-align:center;padding:40px 20px;color:var(--text-muted);font-size:14px;';
            empty.innerHTML = '📺 لا توجد قنوات<br><span style="font-size:12px;">غير الفلتر أو أضف سيرفر جديد</span>';
            channelList.appendChild(empty);
            countLabel.textContent = '0 قناة';
            return;
        }

        for (let i = 0; i < filtered.length; i++) {
            const ch = filtered[i];
            const div = document.createElement('div');
            div.className = 'channel-item' + (i === state.currentIndex ? ' active' : '');
            const isFav = state.favorites.has(ch.url);
            div.innerHTML = `
                <span class="channel-name">${isFav ? '<span class="fav-star">⭐</span>' : ''}${ch.name || 'Unnamed'}</span>
                ${ch.group ? `<span class="channel-group">${ch.group}</span>` : ''}
            `;
            div.dataset.index = i;
            div.addEventListener('click', () => playChannel(i));
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showChannelMenu(e.clientX, e.clientY, i);
            });
            channelList.appendChild(div);
        }

        countLabel.textContent = `${filtered.length} قناة`;
    }

    // ===== PLAY CHANNEL =====
    function playChannel(index) {
        const ch = state.filtered[index];
        if (!ch || !ch.url) {
            showToast('❌ القناة لا تحتوي على رابط', 'error');
            return;
        }

        state.currentIndex = index;
        state.currentChannelUrl = ch.url;
        state.isPlaying = true;
        state.videoLoaded = true;

        // Update active state
        document.querySelectorAll('.channel-item').forEach((el, i) => {
            el.classList.toggle('active', i === index);
        });

        // Hide placeholder
        placeholder.style.display = 'none';
        loadingOverlay.classList.add('active');

        // Set video source and play
        video.src = ch.url;
        video.load();
        
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                loadingOverlay.classList.remove('active');
                state.isPlaying = true;
                updatePlayButton();
                infoLabel.textContent = `▶️ جاري التشغيل: ${ch.name || 'Unnamed'}`;
                infoLabel.className = 'info-label active';
                statusLabel.textContent = `▶️ جاري التشغيل: ${ch.name || 'Unnamed'}`;
                statusLabel.className = 'status-label success';
            }).catch(err => {
                loadingOverlay.classList.remove('active');
                console.warn('Play error:', err);
                handlePlaybackError(ch);
            });
        }

        updatePlayButton();
        infoLabel.textContent = `▶️ جاري التشغيل: ${ch.name || 'Unnamed'}`;
        infoLabel.className = 'info-label active';

        // Add to history
        if (!state.history.includes(ch.url)) {
            state.history.push(ch.url);
            saveHistory();
        }
    }

    function handlePlaybackError(ch) {
        // Try with different video attributes
        video.removeAttribute('controls');
        video.setAttribute('controls', '');
        video.load();
        
        // Try loading as blob
        try {
            const proxyUrl = PROXY_URL + encodeURIComponent(ch.url);
            fetch(proxyUrl)
                .then(res => res.blob())
                .then(blob => {
                    const blobUrl = URL.createObjectURL(blob);
                    video.src = blobUrl;
                    video.load();
                    video.play().catch(() => {
                        showToast('❌ لا يمكن تشغيل هذه القناة', 'error');
                    });
                })
                .catch(() => {
                    showToast('❌ لا يمكن تشغيل هذه القناة', 'error');
                });
        } catch (e) {
            showToast('❌ لا يمكن تشغيل هذه القناة', 'error');
        }
    }

    // ===== VIDEO CONTROLS =====
    function togglePlayPause() {
        if (!state.videoLoaded) {
            const first = channelList.querySelector('.channel-item');
            if (first) first.click();
            return;
        }
        if (video.paused) {
            video.play().catch(() => {});
            state.isPlaying = true;
        } else {
            video.pause();
            state.isPlaying = false;
        }
        updatePlayButton();
    }

    function stopPlayback() {
        video.pause();
        video.currentTime = 0;
        state.isPlaying = false;
        state.videoLoaded = false;
        updatePlayButton();
        infoLabel.textContent = '⏹️ تم الإيقاف';
        infoLabel.className = 'info-label';
        progressSlider.value = 0;
        placeholder.style.display = 'block';
        video.src = '';
    }

    function playNext() {
        if (state.filtered.length === 0) return;
        const next = (state.currentIndex + 1) % state.filtered.length;
        playChannel(next);
        scrollToChannel(next);
    }

    function playPrev() {
        if (state.filtered.length === 0) return;
        const prev = state.currentIndex <= 0 ? state.filtered.length - 1 : state.currentIndex - 1;
        playChannel(prev);
        scrollToChannel(prev);
    }

    function scrollToChannel(index) {
        const items = channelList.querySelectorAll('.channel-item');
        if (items[index]) {
            items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    function updatePlayButton() {
        if (state.isPlaying && !video.paused) {
            playBtn.textContent = '⏸';
            playBtn.classList.add('playing');
        } else {
            playBtn.textContent = '▶';
            playBtn.classList.remove('playing');
        }
    }

    function toggleMute() {
        video.muted = !video.muted;
        state.isMuted = video.muted;
        muteBtn.textContent = video.muted ? '🔇' : '🔊';
    }

    function setVolume(val) {
        const v = parseInt(val);
        video.volume = Math.min(v / 200, 1);
        state.settings.volume = v;
        saveSettings();
        if (v === 0) muteBtn.textContent = '🔇';
        else if (v < 50) muteBtn.textContent = '🔉';
        else if (v < 100) muteBtn.textContent = '🔊';
        else muteBtn.textContent = '🔊';
    }

    function toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
            state.isFullscreen = false;
        } else {
            document.documentElement.requestFullscreen().catch(() => {});
            state.isFullscreen = true;
        }
    }

    // ===== CONTEXT MENU =====
    function showChannelMenu(x, y, index) {
        const ch = state.filtered[index];
        if (!ch) return;
        const isFav = state.favorites.has(ch.url);

        const items = [
            { label: '▶ تشغيل', action: () => playChannel(index) },
            { label: isFav ? '⭐ إزالة من المفضلة' : '⭐ إضافة للمفضلة', action: () => toggleFavorite(index) },
            { label: '📋 نسخ الرابط', action: () => { navigator.clipboard.writeText(ch.url).then(() => showToast('📋 تم النسخ!', 'success')); } },
            { label: 'ℹ️ معلومات القناة', action: () => showChannelInfo(index) }
        ];

        const menuHtml = items.map((item, i) =>
            `<div class="action-btn" style="width:100%;text-align:right;padding:8px 16px;margin:2px 0;border-radius:6px;border:1px solid var(--border);cursor:pointer;" data-action="${i}">${item.label}</div>`
        ).join('');

        modalTitle.textContent = '📺 قائمة القناة';
        modalBody.innerHTML = `
            <div style="margin-bottom:12px;font-size:14px;color:var(--text-secondary);">
                <strong style="color:var(--green);">${ch.name || 'Unnamed'}</strong>
                ${ch.group ? ` · ${ch.group}` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
                ${menuHtml}
            </div>
            <div class="btn-row-modal">
                <button class="action-btn white" onclick="closeModal()">إغلاق</button>
            </div>
        `;
        modalOverlay.classList.add('active');

        setTimeout(() => {
            const btns = modalBody.querySelectorAll('[data-action]');
            btns.forEach((btn, i) => {
                btn.addEventListener('click', () => {
                    items[i].action();
                    closeModal();
                });
            });
        }, 50);
    }

    function showChannelInfo(index) {
        const ch = state.filtered[index];
        if (!ch) return;
        const info = `
            <div style="margin-bottom:8px;"><strong style="color:var(--green);">📺 الاسم:</strong> ${ch.name || 'Unknown'}</div>
            <div style="margin-bottom:8px;"><strong style="color:var(--green);">📂 المجموعة:</strong> ${ch.group || 'غير محددة'}</div>
            <div style="margin-bottom:8px;"><strong style="color:var(--green);">🔗 الرابط:</strong> <span style="color:var(--green-dim);word-break:break-all;font-size:12px;">${ch.url}</span></div>
            <div style="margin-bottom:8px;"><strong style="color:var(--green);">🖼️ الشعار:</strong> ${ch.logo || 'غير متوفر'}</div>
        `;
        modalTitle.textContent = 'ℹ️ معلومات القناة';
        modalBody.innerHTML = `
            ${info}
            <div class="btn-row-modal">
                <button class="action-btn white" onclick="closeModal()">إغلاق</button>
            </div>
        `;
        modalOverlay.classList.add('active');
    }

    function toggleFavorite(index) {
        const ch = state.filtered[index];
        if (!ch) return;
        if (state.favorites.has(ch.url)) {
            state.favorites.delete(ch.url);
            showToast('⭐ تم الإزالة من المفضلة', 'success');
        } else {
            state.favorites.add(ch.url);
            showToast('⭐ تم الإضافة للمفضلة', 'success');
        }
        saveFavorites();
        renderChannels();
        const items = channelList.querySelectorAll('.channel-item');
        if (items[state.currentIndex]) {
            items[state.currentIndex].classList.add('active');
        }
    }

    // ===== MODAL =====
    window.closeModal = function() {
        modalOverlay.classList.remove('active');
    };

    function openAddCodeModal() {
        modalTitle.textContent = '🐭 إضافة سيرفر IPTV';
        modalBody.innerHTML = `
            <div style="margin-bottom:12px;color:var(--text-secondary);font-size:13px;">
                🔥 الصق أي كود سيرفر - يدعم CCcam, Newcamd, MAC, Xtream, Portal, Stalker, M3U
            </div>
            <div class="form-group">
                <label>📝 الصق الكود:</label>
                <textarea id="codeInput" placeholder="مثال: C: server.com 12000 user pass&#10;http://host.com:8080/get.php?username=user&password=pass&type=m3u_plus&#10;A0:BB:3E:18:9E:02"></textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>🏷️ اسم السيرفر</label>
                    <input type="text" id="serverNameInput" placeholder="اسم السيرفر">
                </div>
                <div class="form-group">
                    <label>📦 النوع</label>
                    <select id="serverTypeInput">
                        <option value="m3u_plus">m3u_plus (مفضل)</option>
                        <option value="m3u">m3u (قياسي)</option>
                    </select>
                </div>
            </div>
            <div id="previewUrl" style="margin-top:12px;padding:12px;background:var(--bg-dark);border:2px solid var(--border);border-radius:10px;color:var(--text-muted);font-family:monospace;font-size:12px;word-break:break-all;min-height:40px;">
                ⚡ الرابط النهائي سيظهر هنا...
            </div>
            <div class="btn-row-modal">
                <button class="action-btn white" onclick="closeModal()">إلغاء</button>
                <button class="action-btn green" id="addServerBtn">➕ إضافة سيرفر</button>
            </div>
        `;
        modalOverlay.classList.add('active');

        const codeInput = document.getElementById('codeInput');
        const nameInput = document.getElementById('serverNameInput');
        const typeInput = document.getElementById('serverTypeInput');
        const preview = document.getElementById('previewUrl');
        const addBtn = document.getElementById('addServerBtn');

        let parsedData = null;

        function parseAndPreview() {
            const text = codeInput.value.trim();
            if (!text) {
                preview.textContent = '⚡ الصق الكود للتحليل...';
                preview.style.borderColor = 'var(--border)';
                preview.style.color = 'var(--text-muted)';
                return;
            }
            const result = parseCode(text);
            parsedData = result;
            let url = '';
            let name = nameInput.value.trim() || '';

            if (result.type === 'xtream') {
                const d = result.data;
                url = buildXtreamUrl(d.host, d.username, d.password, typeInput.value);
                if (!name) name = `Xtream (${d.host})`;
            } else if (result.type === 'cccam') {
                const d = result.data;
                url = `http://${d.host}:${d.port}/get.php?username=${d.user}&password=${d.pass}&type=${typeInput.value}`;
                if (!name) name = `CCcam (${d.host})`;
            } else if (result.type === 'newcamd') {
                const d = result.data;
                url = `http://${d.host}:${d.port}/get.php?username=${d.user}&password=${d.pass}&type=${typeInput.value}`;
                if (!name) name = `Newcamd (${d.host})`;
            } else if (result.type === 'mac') {
                const d = result.data;
                if (d.host && d.macs && d.macs.length > 0) {
                    url = `${d.host.replace(/\/+$/, '')}/stalker_portal/server/load.php?type=stb&action=handshake&mac=${d.macs[0]}`;
                }
                if (!name) name = `MAC (${d.macs ? d.macs[0] : 'Unknown'})`;
            } else if (result.type === 'portal' || result.type === 'stalker') {
                const d = result.data;
                url = `${d.host}/get.php?type=${typeInput.value}`;
                if (!name) name = `Portal (${d.host})`;
            } else if (result.type === 'm3u_url') {
                url = result.data.url;
                if (!name) name = `رابط M3U`;
            } else if (result.type === 'generic') {
                url = result.data.host;
                if (!name) name = `عام (${url})`;
            } else {
                preview.textContent = '❌ صيغة غير معروفة. تأكد من الكود.';
                preview.style.borderColor = 'var(--red)';
                preview.style.color = 'var(--red)';
                return;
            }

            if (url) {
                preview.textContent = url;
                preview.style.borderColor = 'var(--green)';
                preview.style.color = 'var(--green)';
                if (!nameInput.value.trim() && name) {
                    nameInput.value = name;
                }
            } else {
                preview.textContent = '⚠️ لا يمكن بناء الرابط. تأكد من الكود.';
                preview.style.borderColor = 'var(--fire-orange)';
                preview.style.color = 'var(--fire-orange)';
            }
        }

        codeInput.addEventListener('input', parseAndPreview);
        nameInput.addEventListener('input', parseAndPreview);
        typeInput.addEventListener('change', parseAndPreview);

        addBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            const url = preview.textContent.trim();
            if (!name) {
                showToast('❌ يرجى إدخال اسم السيرفر', 'error');
                return;
            }
            if (!url || url.startsWith('⚡') || url.startsWith('⚠️') || url.startsWith('❌')) {
                showToast('❌ رابط غير صالح. تأكد من الكود.', 'error');
                return;
            }
            state.customServers[name] = {
                url: url,
                info: parsedData ? parsedData.data : {}
            };
            saveServers();
            refreshServerSelect();
            serverSelect.value = name;
            showToast(`✅ تم الإضافة: ${name}`, 'success');
            closeModal();
            setTimeout(() => loadChannels(name), 300);
        });

        setTimeout(() => codeInput.focus(), 100);
    }

    function openSettingsModal() {
        modalTitle.textContent = '⚙️ الإعدادات';
        const s = state.settings;
        modalBody.innerHTML = `
            <div class="form-group">
                <label>🔊 مستوى الصوت الافتراضي</label>
                <input type="range" id="volSetting" min="0" max="200" value="${s.volume || 100}" style="width:100%;">
                <span id="volDisplay" style="color:var(--green);font-weight:bold;">${s.volume || 100}%</span>
            </div>
            <div class="form-group">
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                    <input type="checkbox" id="muteSetting" ${s.muteOnStart ? 'checked' : ''}>
                    🔇 كتم الصوت عند البدء
                </label>
            </div>
            <div class="form-group">
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                    <input type="checkbox" id="autoLoadSetting" ${s.autoLoad ? 'checked' : ''}>
                    🚀 تحميل تلقائي عند البدء
                </label>
            </div>
            <div class="form-group">
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                    <input type="checkbox" id="showInfoSetting" ${s.showServerInfo !== undefined ? (s.showServerInfo ? 'checked' : '') : 'checked'}>
                    ℹ️ عرض معلومات السيرفر
                </label>
            </div>
            <div class="form-group">
                <label>⏱️ مهلة الاتصال (ثواني)</label>
                <input type="number" id="timeoutSetting" value="${s.timeout || 30}" min="5" max="120">
            </div>
            <div class="btn-row-modal">
                <button class="action-btn white" onclick="closeModal()">إلغاء</button>
                <button class="action-btn green" id="saveSettingsBtn">💾 حفظ</button>
            </div>
        `;
        modalOverlay.classList.add('active');

        const volSlider = document.getElementById('volSetting');
        const volDisplay = document.getElementById('volDisplay');
        volSlider.addEventListener('input', () => {
            volDisplay.textContent = volSlider.value + '%';
        });

        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            state.settings.volume = parseInt(volSlider.value);
            state.settings.muteOnStart = document.getElementById('muteSetting').checked;
            state.settings.autoLoad = document.getElementById('autoLoadSetting').checked;
            state.settings.showServerInfo = document.getElementById('showInfoSetting').checked;
            state.settings.timeout = parseInt(document.getElementById('timeoutSetting').value) || 30;
            saveSettings();
            setVolume(state.settings.volume);
            if (state.settings.muteOnStart) {
                video.muted = true;
                state.isMuted = true;
                muteBtn.textContent = '🔇';
            }
            showToast('✅ تم حفظ الإعدادات!', 'success');
            closeModal();
        });
    }

    function openManageServers() {
        const servers = { ...state.customServers };
        const names = Object.keys(servers);

        if (names.length === 0) {
            showToast('📭 لا توجد سيرفرات. أضف واحداً أولاً!', 'error');
            return;
        }

        let html = `<div style="margin-bottom:12px;color:var(--text-secondary);font-size:13px;">📡 ${names.length} سيرفر(ات) تم تكوينها</div>`;
        for (const name of names) {
            const data = servers[name];
            const infoType = data.info ? data.info.type || 'custom' : 'custom';
            const shortUrl = data.url ? data.url.substring(0, 50) + (data.url.length > 50 ? '...' : '') : '';
            html += `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-input);border-radius:10px;margin-bottom:6px;border:1px solid var(--border);">
                    <div style="flex:1;overflow:hidden;">
                        <div style="font-weight:bold;color:var(--green);">${name}</div>
                        <div style="font-size:11px;color:var(--text-muted);word-break:break-all;">${shortUrl}</div>
                        <div style="font-size:10px;color:var(--text-muted);">📦 ${infoType.toUpperCase()}</div>
                    </div>
                    <button class="action-btn red" style="padding:4px 14px;font-size:11px;border-color:var(--red);color:var(--red);" data-name="${name}">🗑️ حذف</button>
                </div>
            `;
        }
        html += `<div class="btn-row-modal"><button class="action-btn white" onclick="closeModal()">إغلاق</button></div>`;

        modalTitle.textContent = '📡 إدارة السيرفرات';
        modalBody.innerHTML = html;
        modalOverlay.classList.add('active');

        modalBody.querySelectorAll('[data-name]').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.dataset.name;
                if (confirm(`⚠️ حذف السيرفر '${name}'؟`)) {
                    delete state.customServers[name];
                    saveServers();
                    refreshServerSelect();
                    showToast(`🗑️ تم الحذف: ${name}`, 'success');
                    openManageServers();
                }
            });
        });
    }

    // ===== SERVER SELECT =====
    function refreshServerSelect() {
        const current = serverSelect.value;
        serverSelect.innerHTML = '';
        const customNames = Object.keys(state.customServers);

        if (customNames.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = '-- لا يوجد سيرفرات --';
            serverSelect.appendChild(opt);
        } else {
            for (const name of customNames) {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                serverSelect.appendChild(opt);
            }
        }

        if (current && [...serverSelect.options].some(o => o.value === current)) {
            serverSelect.value = current;
        }
    }

    // ===== FILE LOAD =====
    function loadFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.m3u,.m3u8';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const content = ev.target.result;
                    state.loading = true;
                    updateUIForLoading(true);
                    progressBar.classList.add('active');
                    progressFill.style.width = '30%';
                    statusLabel.textContent = `📁 جاري التحميل: ${file.name}`;
                    statusLabel.className = 'status-label';
                    setTimeout(() => {
                        const channels = parseM3U(content);
                        if (channels.length === 0) {
                            throw new Error('لم يتم العثور على قنوات في الملف');
                        }
                        progressFill.style.width = '90%';
                        state.serverInfo = {};
                        onChannelsLoaded(channels);
                        statusLabel.textContent = `✅ تم التحميل من الملف: ${file.name}`;
                        statusLabel.className = 'status-label success';
                        showToast(`✅ تم تحميل ${channels.length} قناة من الملف`, 'success');
                    }, 200);
                } catch (err) {
                    showToast('❌ خطأ في قراءة الملف: ' + err.message, 'error');
                    state.loading = false;
                    updateUIForLoading(false);
                    progressBar.classList.remove('active');
                    statusLabel.textContent = '❌ خطأ في قراءة الملف';
                    statusLabel.className = 'status-label error';
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // ===== VIDEO EVENT LISTENERS =====
    video.addEventListener('timeupdate', () => {
        if (video.duration) {
            const pct = (video.currentTime / video.duration) * 1000;
            progressSlider.value = Math.min(pct, 1000);
        }
    });

    video.addEventListener('play', () => {
        state.isPlaying = true;
        updatePlayButton();
        infoLabel.className = 'info-label active';
        placeholder.style.display = 'none';
        loadingOverlay.classList.remove('active');
    });

    video.addEventListener('pause', () => {
        state.isPlaying = false;
        updatePlayButton();
    });

    video.addEventListener('ended', () => {
        state.isPlaying = false;
        updatePlayButton();
        playNext();
    });

    video.addEventListener('error', (e) => {
        console.warn('Video error:', e);
        loadingOverlay.classList.remove('active');
        if (state.currentChannelUrl) {
            setTimeout(() => {
                video.src = state.currentChannelUrl;
                video.load();
                video.play().catch(() => {});
            }, 1000);
        }
    });

    // ===== DRAG & DROP =====
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.name.match(/\.m3u8?$/i)) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const content = ev.target.result;
                        state.loading = true;
                        updateUIForLoading(true);
                        progressBar.classList.add('active');
                        progressFill.style.width = '30%';
                        statusLabel.textContent = `📁 جاري التحميل: ${file.name}`;
                        statusLabel.className = 'status-label';
                        setTimeout(() => {
                            const channels = parseM3U(content);
                            if (channels.length === 0) {
                                throw new Error('لم يتم العثور على قنوات');
                            }
                            progressFill.style.width = '90%';
                            state.serverInfo = {};
                            onChannelsLoaded(channels);
                            statusLabel.textContent = `✅ تم التحميل من الملف: ${file.name}`;
                            statusLabel.className = 'status-label success';
                            showToast(`✅ تم تحميل ${channels.length} قناة من الملف`, 'success');
                        }, 200);
                    } catch (err) {
                        showToast('❌ خطأ في قراءة الملف: ' + err.message, 'error');
                        state.loading = false;
                        updateUIForLoading(false);
                        progressBar.classList.remove('active');
                        statusLabel.textContent = '❌ خطأ في قراءة الملف';
                        statusLabel.className = 'status-label error';
                    }
                };
                reader.readAsText(file);
                showToast(`📁 جاري التحميل: ${file.name}`, 'success');
            }
        }
    });

    // ===== INIT =====
    function init() {
        loadData();
        refreshServerSelect();

        // Apply settings
        setVolume(state.settings.volume || 100);
        if (state.settings.muteOnStart) {
            video.muted = true;
            state.isMuted = true;
            muteBtn.textContent = '🔇';
        }

        const serverCount = Object.keys(state.customServers).length;
        if (serverCount === 0) {
            statusLabel.textContent = '📭 لا توجد سيرفرات. اضغط "إضافة سيرفر" للبدء!';
            statusLabel.className = 'status-label';
            showToast('📭 أضف سيرفرك الأول للبدء!', 'success');
        } else {
            statusLabel.textContent = '🚀 جاهز. اختر سيرفر واضغط تحميل.';
            statusLabel.className = 'status-label';
            showToast(`🐭 ${APP_NAME} v${APP_VERSION} جاهز`, 'success');
        }

        // Load auto
        if (state.settings.autoLoad && serverCount > 0) {
            setTimeout(() => {
                const firstServer = Object.keys(state.customServers)[0];
                if (firstServer) {
                    serverSelect.value = firstServer;
                    loadChannels(firstServer);
                }
            }, 500);
        }

        // ===== EVENT LISTENERS =====
        serverSelect.addEventListener('change', () => {
            state.selectedServer = serverSelect.value;
        });

        loadBtn.addEventListener('click', () => {
            const selected = serverSelect.value;
            if (!selected || selected === '-- لا يوجد سيرفرات --') {
                showToast('❌ يرجى إضافة سيرفر أولاً', 'error');
                return;
            }
            loadChannels(selected);
        });
        
        fileBtn.addEventListener('click', loadFile);
        addCodeBtn.addEventListener('click', openAddCodeModal);
        manageBtn.addEventListener('click', openManageServers);
        settingsBtn.addEventListener('click', openSettingsModal);

        favBtn.addEventListener('click', () => {
            state.favView = !state.favView;
            favBtn.classList.toggle('fav-active');
            favBtn.textContent = state.favView ? '⭐ المفضلة (نشط)' : '⭐ المفضلة';
            renderChannels();
        });

        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            renderChannels();
        });

        groupSelect.addEventListener('change', (e) => {
            state.currentGroup = e.target.value;
            renderChannels();
        });

        playBtn.addEventListener('click', togglePlayPause);
        stopBtn.addEventListener('click', stopPlayback);
        prevBtn.addEventListener('click', playPrev);
        nextBtn.addEventListener('click', playNext);
        muteBtn.addEventListener('click', toggleMute);
        fullscreenBtn.addEventListener('click', toggleFullscreen);

        volSlider.addEventListener('input', (e) => {
            setVolume(e.target.value);
        });

        progressSlider.addEventListener('input', (e) => {
            if (video.duration) {
                const pos = (e.target.value / 1000) * video.duration;
                video.currentTime = pos;
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    togglePlayPause();
                    break;
                case 's':
                case 'S':
                    stopPlayback();
                    break;
                case 'ArrowRight':
                    playNext();
                    break;
                case 'ArrowLeft':
                    playPrev();
                    break;
                case 'ArrowUp':
                    volSlider.value = Math.min(parseInt(volSlider.value) + 10, 200);
                    setVolume(volSlider.value);
                    break;
                case 'ArrowDown':
                    volSlider.value = Math.max(parseInt(volSlider.value) - 10, 0);
                    setVolume(volSlider.value);
                    break;
                case 'm':
                case 'M':
                    toggleMute();
                    break;
                case 'f':
                case 'F':
                    toggleFullscreen();
                    break;
                case 'Escape':
                    if (document.fullscreenElement) {
                        document.exitFullscreen().catch(() => {});
                    }
                    if (modalOverlay.classList.contains('active')) {
                        closeModal();
                    }
                    break;
            }
        });

        document.addEventListener('fullscreenchange', () => {
            state.isFullscreen = !!document.fullscreenElement;
        });

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        console.log(`🐭 ${APP_NAME} v${APP_VERSION} initialized`);
    }

    // ===== START =====
    document.addEventListener('DOMContentLoaded', init);

    // Expose
    window.closeModal = closeModal;
    window.showToast = showToast;
    window.loadChannels = loadChannels;
    window.playChannel = playChannel;
    window.toggleFavorite = toggleFavorite;
    window.openAddCodeModal = openAddCodeModal;
    window.openSettingsModal = openSettingsModal;
    window.openManageServers = openManageServers;
    window.toggleFullscreen = toggleFullscreen;
    window.togglePlayPause = togglePlayPause;
    window.stopPlayback = stopPlayback;
    window.playNext = playNext;
    window.playPrev = playPrev;
    window.toggleMute = toggleMute;
    window.setVolume = setVolume;

})();
