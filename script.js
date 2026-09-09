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
    if (filaEpisodios.length === 0) filaEpisodios = embaralhar(EPISODIOS);
    return filaEpisodios.pop();
}

function obterProximoAnuncio() {
    if (filaAnuncios.length === 0) filaAnuncios = embaralhar(LISTA_ANUNCIOS);
    return filaAnuncios.pop();
}

async function carregarPlaylist() {
    try {
        const resposta = await fetch(URL_PLAYLIST);
        if (!resposta.ok) throw new Error(`HTTP error! status: ${resposta.status}`);
        
        const dados = await resposta.json();
        
        ANUNCIO_ABERTURA = dados.anuncios.abertura;
        LISTA_ANUNCIOS = Array.isArray(dados.anuncios.entre_episodios) 
            ? dados.anuncios.entre_episodios 
            : [dados.anuncios.entre_episodios];

        EPISODIOS = dados.episodios;

        filaEpisodios = embaralhar(EPISODIOS);
        filaAnuncios = embaralhar(LISTA_ANUNCIOS);

    } catch (erro) {
        console.error("Erro ao carregar o playlist.json:", erro);
    }
}

function carregar(url) {
    if (!url) {
        console.warn("URL vazia, pulando...");
        proximo();
        return;
    }

    if (hls) {
        hls.destroy();
        hls = null;
    }
    video.pause();
    video.removeAttribute('src');
    video.load();

    const tentarTocar = () => {
        video.play().catch(e => {
            console.warn("Autoplay bloqueado pelo navegador, tentando no mudo:", e);
            video.muted = true;
            video.play().catch(() => proximo());
        });
    };

    if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, tentarTocar);
        hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
                console.error("Erro fatal no HLS ao carregar:", url);
                hls.destroy();
                proximo();
            }
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        tentarTocar();
    } else {
        video.src = url;
        tentarTocar();
    }
}

function proximo() {
    if (EPISODIOS.length === 0) return;

    if (modo === 'abertura') {
        modo = 'episodio';
        const ep = obterProximoEpisodio();
        carregar(ep ? ep.url : null);
    } else if (modo === 'episodio') {
        modo = 'anuncio';
        const anuncio = obterProximoAnuncio();
        carregar(anuncio);
    } else if (modo === 'anuncio') {
        modo = 'episodio';
        const ep = obterProximoEpisodio();
        carregar(ep ? ep.url : null);
    }
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
        progresso += 5;
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
                }

                modo = 'abertura';
                carregar(ANUNCIO_ABERTURA);
            }, 200);
        }
    }, 50);
}

aviso.addEventListener('click', iniciarSessao);
aviso.addEventListener('touchstart', (e) => {
    e.preventDefault();
    iniciarSessao();
});

document.addEventListener('keydown', (e) => {
    if (!iniciado) {
        if (e.key === 'Enter' || e.keyCode === 13) iniciarSessao();
        return;
    }

    if (e.key === 'ArrowRight' || e.keyCode === 39) proximo();
    if (e.key === 'Enter' || e.keyCode === 13) {
        video.paused ? video.play() : video.pause();
    }
});

video.addEventListener('ended', proximo);

window.addEventListener('load', () => {
    carregarPlaylist();
    aviso.focus();
});
