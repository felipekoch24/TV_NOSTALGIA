const video = document.getElementById('player');
const aviso = document.getElementById('aviso');
const carregando = document.getElementById('carregando');
const textoCarregando = document.getElementById('texto-carregando');
const progressoInterno = document.getElementById('progresso-interno');

let hls = null;
let modo = 'abertura';
let iniciado = false;

let ANUNCIO_ABERTURA = "";
let LISTA_ANUNCIOS = [];
let EPISODIOS = [];

let filaEpisodios = [];
let filaAnuncios = [];

const URL_PLAYLIST = "playlist.json"; 

function embaralhar(array) {
    let copia = [...array];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
}

function obterProximoEpisodio() {
    if (filaEpisodios.length === 0) {
        filaEpisodios = embaralhar(EPISODIOS);
    }
    return filaEpisodios.pop();
}

function obterProximoAnuncio() {
    if (filaAnuncios.length === 0) {
        filaAnuncios = embaralhar(LISTA_ANUNCIOS);
    }
    return filaAnuncios.pop();
}

async function carregarPlaylist() {
    try {
        const resposta = await fetch(URL_PLAYLIST);
        if (!resposta.ok) throw new Error(`HTTP error! status: ${resposta.status}`);
        
        const dados = await resposta.json();
        
        ANUNCIO_ABERTURA = dados.anuncios.abertura;
        
        // Aceita se for array de anúncios ou apenas uma string única no JSON
        if (Array.isArray(dados.anuncios.entre_episodios)) {
            LISTA_ANUNCIOS = dados.anuncios.entre_episodios;
        } else {
            LISTA_ANUNCIOS = [dados.anuncios.entre_episodios];
        }

        EPISODIOS = dados.episodios;

        filaEpisodios = embaralhar(EPISODIOS);
        filaAnuncios = embaralhar(LISTA_ANUNCIOS);

    } catch (erro) {
        console.error("Erro ao carregar o playlist.json:", erro);
    }
}

function carregar(url) {
    if (!url) return;

    if (hls) {
        hls.destroy();
        hls = null;
    }
    video.pause();
    video.removeAttribute('src');
    video.load();

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.play().catch(() => proximo());
    } 
    else if (Hls.isSupported()) {
        hls = new Hls({ 
            maxBufferSize: 30 * 1000 * 1000, 
            enableWorker: true,
            xhrSetup: function (xhr) {
                xhr.withCredentials = false;
            }
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch((err) => {
                console.warn("Autoplay bloqueado:", err);
            });
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
                hls.destroy();
                proximo();
            }
        });
    } else {
        video.src = url;
        video.play().catch(() => proximo());
    }
}

function proximo() {
    if (EPISODIOS.length === 0) return;

    if (modo === 'abertura') {
        modo = 'episodio';
        const ep = obterProximoEpisodio();
        carregar(ep.url);
    } else if (modo === 'episodio') {
        modo = 'anuncio';
        const anuncio = obterProximoAnuncio();
        carregar(anuncio);
    } else if (modo === 'anuncio') {
        modo = 'episodio';
        const ep = obterProximoEpisodio();
        carregar(ep.url);
    }
}

function anterior() {
    if (EPISODIOS.length === 0) return;
    modo = 'anuncio';
    const anuncio = obterProximoAnuncio();
    carregar(anuncio);
}

async function iniciarSessao() {
    if (iniciado) return;
    iniciado = true;

    aviso.style.display = 'none';
    carregando.style.display = 'flex';

    if (EPISODIOS.length === 0) {
        await carregarPlaylist();
    }

    let progresso = 0;
    const intervaloSimulacao = setInterval(() => {
        progresso += 4;
        if (progresso > 100) progresso = 100;
        
        textoCarregando.innerText = `Sintonizando Canal (${progresso}%)`;
        progressoInterno.style.width = `${progresso}%`;

        if (progresso >= 100) {
            clearInterval(intervaloSimulacao);
            
            setTimeout(() => {
                carregando.style.display = 'none';
                video.style.display = 'block';

                if (video.requestFullscreen) {
                    video.requestFullscreen().catch(() => {});
                } else if (video.webkitRequestFullscreen) {
                    video.webkitRequestFullscreen().catch(() => {});
                }

                modo = 'abertura';
                carregar(ANUNCIO_ABERTURA);
            }, 300);
        }
    }, 80);
}

aviso.addEventListener('click', iniciarSessao);
aviso.addEventListener('touchstart', (e) => {
    e.preventDefault();
    iniciarSessao();
});

document.addEventListener('keydown', (e) => {
    const key = e.key;
    const code = e.keyCode;

    if (!iniciado) {
        if (key === 'Enter' || code === 13 || code === 66) {
            iniciarSessao();
        }
        return;
    }

    // Troca de canal (setas do controle remoto / teclado)
    if (key === 'ArrowLeft' || code === 37 || code === 227) {
        e.preventDefault();
        anterior();
    } 
    else if (key === 'ArrowRight' || code === 39 || code === 228) {
        e.preventDefault();
        proximo();
    } 
    else if (key === 'Enter' || code === 13 || code === 66 || code === 179) {
        e.preventDefault();
        video.paused ? video.play() : video.pause();
    }
});

video.addEventListener('ended', proximo);

window.addEventListener('load', () => {
    carregarPlaylist();
    aviso.focus();
});
