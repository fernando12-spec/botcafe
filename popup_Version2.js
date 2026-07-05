document.addEventListener('DOMContentLoaded', () => {
    updateStatus();
    setInterval(updateStatus, 2000);

    document.getElementById('clearBtn').addEventListener('click', () => {
        chrome.storage.local.remove('activeDevice');
        updateStatus();
    });
});

function updateStatus() {
    chrome.storage.local.get('activeDevice', (result) => {
        const statusBox = document.getElementById('deviceStatus');
        const devicesList = document.getElementById('devicesList');

        if (result.activeDevice) {
            const device = result.activeDevice;
            const timeSince = Math.round((Date.now() - device.timestamp) / 1000);
            const deviceType = device.type === 'video' ? '🎬 Vídeo' : '📸 Foto';
            const shortUrl = new URL(device.tabUrl).hostname;

            statusBox.innerHTML = `
                <div class="status-active">
                    <p><strong>Status:</strong> ✅ ATIVO</p>
                    <p><strong>Tipo:</strong> ${deviceType}</p>
                    <p><strong>Índice:</strong> #${device.index + 1}</p>
                    <p><strong>Site:</strong> ${shortUrl}</p>
                    <p><strong>Tempo:</strong> ${timeSince}s</p>
                </div>
            `;

            devicesList.innerHTML = `
                <div class="device-item active">
                    <span>${deviceType} #${device.index + 1}</span>
                    <span class="badge">🟢 ATIVO</span>
                </div>
            `;
        } else {
            statusBox.innerHTML = '<p class="status-inactive">Nenhum dispositivo ativo</p>';
            devicesList.innerHTML = '<p class="no-devices">Carregue mídia na página para ativar dispositivos</p>';
        }
    });
}