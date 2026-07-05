// ==UserScript==
// @name         Upload Manual + Tr + Galeria
// @namespace    vfs.dynamic.fix
// @version      16.0
// @description  Upload manual + trocar imagem ilimitado + galeria de até 4 fotos recentes
// @match        https://visa.vfsglobal.com/*
// @grant        none
// ==/UserScript==
(function () {
    'use strict';

    const STORAGE_KEY = "vfs_fotos_galeria";
    const MAX_FOTOS = 4;

    let inputReal = null;

    function log(msg) {
        console.log("[VFS FIX]", msg);
    }

    function trigger(input) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 👀 observa sempre (resolve SPA da VFS)
    function observar() {
        const observer = new MutationObserver(() => {
            const input = document.querySelector('input[type="file"]');
            if (input) {
                inputReal = input;
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 🔎 tenta clicar em Browse ou Replace
    function clicarBotaoReal() {
        const els = [...document.querySelectorAll("*")];
        const btn = els.find(el =>
            el.innerText &&
            (
                el.innerText.toLowerCase().includes("browse") ||
                el.innerText.toLowerCase().includes("replace")
            )
        );
        if (btn) {
            log("Clicando botão real...");
            btn.click();
            return true;
        }
        return false;
    }

    // ---------- GALERIA (localStorage) ----------

    function carregarGaleria() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            log("Erro ao ler galeria: " + e);
            return [];
        }
    }

    function salvarGaleria(lista) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
        } catch (e) {
            log("Erro ao salvar galeria (pode ter estourado espaço): " + e);
            alert("Não foi possível salvar essa foto na galeria (espaço cheio). O upload em si funcionou normalmente.");
        }
    }

    function fileParaDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function dataURLParaFile(dataUrl, nome) {
        const [meta, base64] = dataUrl.split(',');
        const mimeMatch = meta.match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const bin = atob(base64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
            arr[i] = bin.charCodeAt(i);
        }
        return new File([arr], nome, { type: mime });
    }

    async function adicionarNaGaleria(file) {
        try {
            const dataUrl = await fileParaDataURL(file);
            let lista = carregarGaleria();
            // remove duplicata pelo nome+tamanho se existir
            lista = lista.filter(item => item.nome !== file.name);
            lista.unshift({ nome: file.name, dataUrl: dataUrl, data: Date.now() });
            lista = lista.slice(0, MAX_FOTOS);
            salvarGaleria(lista);
            renderizarGaleria();
        } catch (e) {
            log("Erro ao adicionar na galeria: " + e);
        }
    }

    function excluirDaGaleria(item) {
        let lista = carregarGaleria();
        lista = lista.filter(f => f.data !== item.data);
        salvarGaleria(lista);
        renderizarGaleria();
    }

    function injetarFileNoInput(file) {
        if (!inputReal) {
            alert("Abre a área de upload primeiro.");
            return;
        }
        const dt = new DataTransfer();
        dt.items.add(file);
        inputReal.files = dt.files;
        setTimeout(() => {
            trigger(inputReal);
            log("Imagem da galeria enviada!");
        }, 200);
    }

    function usarFotoDaGaleria(item) {
        log("Clique na galeria: " + item.nome);
        clicarBotaoReal();
        setTimeout(() => {
            const file = dataURLParaFile(item.dataUrl, item.nome);
            injetarFileNoInput(file);
        }, 600);
    }

    // ---------- UI ----------

    let galeriaContainer = null;

    function renderizarGaleria() {
        if (!galeriaContainer) return;
        galeriaContainer.innerHTML = "";
        const lista = carregarGaleria();

        lista.forEach(item => {
            const thumb = document.createElement("div");
            thumb.style.width = "80px";
            thumb.style.height = "80px";
            thumb.style.borderRadius = "8px";
            thumb.style.overflow = "hidden";
            thumb.style.cursor = "pointer";
            thumb.style.border = "2px solid #fff";
            thumb.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
            thumb.style.transition = "transform 0.15s ease";
            thumb.style.position = "relative";
            thumb.title = "Usar: " + item.nome;
            thumb.onmouseenter = () => { thumb.style.transform = "scale(1.08)"; };
            thumb.onmouseleave = () => { thumb.style.transform = "scale(1)"; };

            const img = document.createElement("img");
            img.src = item.dataUrl;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            img.style.display = "block";

            const delBtn = document.createElement("div");
            delBtn.innerText = "✕";
            delBtn.title = "Excluir foto";
            delBtn.style.position = "absolute";
            delBtn.style.top = "2px";
            delBtn.style.right = "2px";
            delBtn.style.width = "18px";
            delBtn.style.height = "18px";
            delBtn.style.lineHeight = "18px";
            delBtn.style.textAlign = "center";
            delBtn.style.fontSize = "11px";
            delBtn.style.color = "#fff";
            delBtn.style.background = "rgba(200,0,0,0.85)";
            delBtn.style.borderRadius = "50%";
            delBtn.style.cursor = "pointer";
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm("Excluir esta foto da galeria?")) {
                    excluirDaGaleria(item);
                }
            };

            thumb.appendChild(img);
            thumb.appendChild(delBtn);
            thumb.onclick = () => usarFotoDaGaleria(item);
            galeriaContainer.appendChild(thumb);
        });
    }

    // 📂 abre seletor e injeta imagem (upload manual normal)
    function abrirSeletor(input) {
        const fake = document.createElement("input");
        fake.type = "file";
        fake.accept = "image/*";
        fake.onchange = () => {
            const file = fake.files[0];
            if (!file) return;
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            setTimeout(() => {
                trigger(input);
                log("Imagem enviada/trocada!");
            }, 200);
            adicionarNaGaleria(file);
        };
        fake.click();
    }

    function iniciar() {
        log("Clique manual detectado");
        clicarBotaoReal();
        setTimeout(() => {
            if (inputReal) {
                abrirSeletor(inputReal);
            } else {
                alert("Abre a área de upload primeiro.");
            }
        }, 600);
    }

    function criarBotao() {
        const wrapper = document.createElement("div");
        wrapper.style.position = "fixed";
        wrapper.style.bottom = "15px";
        wrapper.style.left = "15px";
        wrapper.style.zIndex = "999999";
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        wrapper.style.gap = "10px";

        const btn = document.createElement("button");
        btn.innerText = "📷";
        btn.style.padding = "16px 18px";
        btn.style.fontSize = "20px";
        btn.style.background = "blue";
        btn.style.color = "#fff";
        btn.style.border = "none";
        btn.style.borderRadius = "6px";
        btn.style.cursor = "pointer";
        btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
        btn.onclick = iniciar;

        galeriaContainer = document.createElement("div");
        galeriaContainer.style.display = "flex";
        galeriaContainer.style.gap = "10px";

        wrapper.appendChild(btn);
        wrapper.appendChild(galeriaContainer);
        document.body.appendChild(wrapper);

        renderizarGaleria();
    }

    function init() {
        log("Script pronto");
        observar();
        window.addEventListener("load", () => {
            setTimeout(criarBotao, 1500);
        });
    }

    init();
})();
