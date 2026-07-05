(function () {
    'use strict';

    const _origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const _origED  = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);

    const MOCK_ID    = 'fakedev-' + Math.random().toString(36).slice(2, 10);
    const MOCK_GRP   = 'fakegrp-' + Math.random().toString(36).slice(2, 10);
    const MOCK_LABEL = 'HD Webcam C920 (Cafe Bot)';

    navigator.mediaDevices.getUserMedia = async function (constraints) {
        try {
            if (!constraints || !(constraints.video === true || typeof constraints.video === 'object')) {
                return _origGUM(constraints);
            }
            let stream = window.__fakeCamStream || (window !== window.top && window.top && window.top.__fakeCamStream);
            if (stream) {
                const tracks = stream.getVideoTracks ? stream.getVideoTracks() : [];
                if (tracks.length === 0 || tracks[0].readyState === 'ended') stream = null;
            }
            if (!stream && window !== window.top && window.top && window.top.__fakeCamRevive) {
                stream = window.top.__fakeCamRevive();
            }
            return stream ? Promise.resolve(stream) : _origGUM(constraints);
        } catch (err) {
            return _origGUM(constraints);
        }
    };

    navigator.mediaDevices.enumerateDevices = async function () {
        try {
            const real = await _origED();
            return [
                ...real.filter(d => d.kind !== 'videoinput'),
                { 
                    deviceId: MOCK_ID, 
                    groupId: MOCK_GRP, 
                    kind: 'videoinput', 
                    label: MOCK_LABEL,
                    toJSON() { 
                        return { deviceId: MOCK_ID, groupId: MOCK_GRP, kind: 'videoinput', label: MOCK_LABEL }; 
                    } 
                }
            ];
        } catch { 
            return _origED(); 
        }
    };

    if (window !== window.top) return;

    const MAX_SLOTS = 10;
    let slots = [], activeSlot = -1, active = false;
    let canvas = null, ctx2d = null, rafId = null;
    let zoomLevel = 1.0, animTime = 0;
    const ZOOM_STEP = 0.1;
    const ui = {};
    let L = { driftX: 0, driftY: 0, breathZoom: 1, finalBright: 1 };

    function updateLiveness(dt) {
        animTime += dt;
        L.driftX = Math.sin(animTime * 0.002) * 4;
        L.driftY = Math.cos(animTime * 0.0015) * 3;
        L.breathZoom = 1 + Math.sin(animTime * 0.001) * 0.004;
        L.finalBright = 1 + Math.sin(animTime * 0.0025) * 0.012;
    }

    const $ = (tag, css, props) => {
        const e = document.createElement(tag);
        if (css)   Object.assign(e.style, css);
        if (props) Object.assign(e, props);
        return e;
    };

    const mkBtn = (text, bg, cb, extra) => {
        const b = $('button', {
            background: bg, color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '4px', cursor: 'pointer', fontSize: '11px', padding: '4px 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }, extra);
        b.textContent = text;
        b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); cb(); });
        return b;
    };

    function drawFrame(source, isVideo) {
        if (isVideo && (!source.videoWidth || !source.videoHeight)) return;
        const sw = isVideo ? source.videoWidth  : source.width;
        const sh = isVideo ? source.videoHeight : source.height;
        const base = Math.min(1280 / sw, 720 / sh);
        const zoom = zoomLevel * L.breathZoom;
        const iw = sw * base * zoom, ih = sh * base * zoom;
        const fx = (1280 - iw) / 2 + L.driftX;
        const fy = (720 - ih) / 2 + L.driftY;

        ctx2d.fillStyle = '#000';
        ctx2d.fillRect(0, 0, 1280, 720);
        ctx2d.save();
        ctx2d.filter = `brightness(${L.finalBright.toFixed(2)})`;
        ctx2d.drawImage(source, fx, fy, iw, ih);
        ctx2d.restore();
    }

    function startStream(slotIdx) {
        if (slotIdx < 0 || slotIdx >= slots.length) return;
        activeSlot = slotIdx;
        const slot = slots[slotIdx];

        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.width = 1280; canvas.height = 720;
            ctx2d = canvas.getContext('2d', { alpha: false, desynchronized: true });
        }

        if (rafId) cancelAnimationFrame(rafId);
        let lastTs = null;
        const isVideo = slot.type === 'video';
        if (isVideo) try { slot.videoEl.play(); } catch(_) {}

        const loop = (ts) => {
            if (!lastTs) lastTs = ts;
            updateLiveness(Math.min(ts - lastTs, 50));
            lastTs = ts;
            drawFrame(isVideo ? slot.videoEl : slot.img, isVideo);
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);

        window.__fakeCamStream = canvas.captureStream(30);
        window.__fakeCamRevive = () => canvas ? canvas.captureStream(30) : null;
        active = true;
        
        chrome.runtime.sendMessage({ type: 'DEVICE_ACTIVE', device: slot.type, index: slotIdx });
        
        renderSlots();
    }

    function loadFiles(files) {
        const toLoad = Array.from(files).slice(0, MAX_SLOTS - slots.length);
        let done = 0;
        toLoad.forEach(file => {
            const url = URL.createObjectURL(file);
            if (file.type.startsWith('video/')) {
                const vel = document.createElement('video');
                vel.src = url; vel.loop = true; vel.muted = true; vel.playsInline = true;
                vel.addEventListener('loadeddata', () => {
                    const tc = document.createElement('canvas'); tc.width = tc.height = 64;
                    tc.getContext('2d').drawImage(vel,0,0,64,64);
                    slots.push({ type:'video', videoEl:vel, thumb:tc.toDataURL() });
                    if (++done === toLoad.length) { renderSlots(); startStream(slots.length - 1); }
                });
                vel.load();
            } else {
                const img = new Image();
                img.onload = () => {
                    const tc = document.createElement('canvas'); tc.width = tc.height = 64;
                    tc.getContext('2d').drawImage(img,0,0,64,64);
                    slots.push({ type:'photo', img, thumb:tc.toDataURL() });
                    if (++done === toLoad.length) { renderSlots(); startStream(slots.length - 1); }
                };
                img.src = url;
            }
        });
    }

    function renderSlots() {
        if (!ui.slotGrid) return;
        ui.slotGrid.innerHTML = '';
        slots.forEach((s, i) => {
            const wrap = $('div', {
                position:'relative', width:'54px', height:'54px', borderRadius:'6px', overflow:'hidden',
                border: (i === activeSlot && active) ? '2px solid #2ecc71' : '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer'
            });
            const thumb = $('img', { width:'100%', height:'100%', objectFit:'cover', display:'block' });
            thumb.src = s.thumb;
            thumb.onclick = () => startStream(i);
            wrap.title = `${s.type === 'video' ? 'Video' : 'Foto'} #${i + 1}`;
            if (s.type === 'video') {
                const ic = $('div', { position:'absolute', bottom:'2px', left:'2px', fontSize:'8px' });
                ic.textContent = '🎬'; wrap.appendChild(ic);
            }
            wrap.appendChild(thumb);
            ui.slotGrid.appendChild(wrap);
        });
        if (slots.length < MAX_SLOTS) {
            const add = $('div', {
                width:'54px', height:'54px', borderRadius:'6px', border:'1px dashed rgba(255,255,255,0.4)',
                display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:'18px', color:'rgba(255,255,255,0.5)'
            });
            add.textContent = '+'; add.onclick = () => ui.fileInp.click();
            ui.slotGrid.appendChild(add);
        }
    }

    let estadoOculto = false;

    function initUI() {
        if (document.getElementById('fakecam-main-panel')) return;

        const alvo = document.body || document.documentElement;
        if (!alvo) return;

        const panel = $('div', {
            position: 'fixed', bottom: '20px', right: '20px', zIndex: '2147483647',
            background: '#121214', color: '#fff', padding: '12px', borderRadius: '8px',
            fontFamily: 'system-ui, sans-serif', width: estadoOculto ? '130px' : '270px', border: '1px solid #222',
            boxShadow: '0 8px 24px rgba(0,0,0,0.8)'
        }, { id: 'fakecam-main-panel' });

        const header = $('div', { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px', fontSize:'12px', fontWeight:'bold' });

        const titleSpan = $('span', null);
        titleSpan.innerHTML = `<span style="color:#2ecc71; letter-spacing: 1px;">📷 CAFE BOT</span>`;
        header.appendChild(titleSpan);

        ui.slotGrid = $('div', { display: estadoOculto ? 'none' : 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '12px' });
        ui.fileInp = $('input', null, { type: 'file', accept: 'image/*,video/*', multiple: true, style: 'display:none' });
        ui.fileInp.onchange = (e) => { if (e.target.files.length) loadFiles(e.target.files); };

        const actBtn = mkBtn("🟢 Ativar / Carregar", "#27ae60", () => ui.fileInp.click(), {
            width:'100%', padding:'8px', fontWeight:'bold', marginBottom:'10px', display: estadoOculto ? 'none' : 'flex'
        });

        const zoomRow = $('div', {
            display: estadoOculto ? 'none' : 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'
        });
        const zOut = mkBtn("-", "#222", () => { zoomLevel = Math.max(0.5, zoomLevel - ZOOM_STEP); ui.zoomLbl.textContent = zoomLevel.toFixed(1) + 'x'; }, { width:'30px' });
        ui.zoomLbl = $('span', { fontSize: '12px', fontWeight: 'bold' }); ui.zoomLbl.textContent = "1.0x";
        const zIn = mkBtn("+", "#222", () => { zoomLevel = Math.min(3, zoomLevel + ZOOM_STEP); ui.zoomLbl.textContent = zoomLevel.toFixed(1) + 'x'; }, { width:'30px' });
        zoomRow.appendChild(zOut); zoomRow.appendChild(ui.zoomLbl); zoomRow.appendChild(zIn);

        const elementosControle = [ui.slotGrid, actBtn, zoomRow];

        const toggleBtn = mkBtn(estadoOculto ? "Mostrar 📷" : "Ocultar ✖", estadoOculto ? "#27ae60" : "#c0392b", () => {
            estadoOculto = !estadoOculto;
            elementosControle.forEach(el => el.style.display = estadoOculto ? 'none' : '');
            panel.style.width = estadoOculto ? '130px' : '270px';
            toggleBtn.textContent = estadoOculto ? "Mostrar 📷" : "Ocultar ✖";
            toggleBtn.style.background = estadoOculto ? "#27ae60" : "#c0392b";
            if (!estadoOculto) renderSlots();
        }, { fontSize: '9px', padding: '2px 6px' });

        header.appendChild(toggleBtn);
        panel.appendChild(header);
        panel.appendChild(ui.slotGrid);
        panel.appendChild(ui.fileInp);
        panel.appendChild(actBtn);
        panel.appendChild(zoomRow);

        alvo.appendChild(panel);
        if (!estadoOculto) renderSlots();
    }

    setInterval(() => {
        initUI();
    }, 1200);

})();
