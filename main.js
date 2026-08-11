const TMDB_API_KEY = '8265bd1679663a7ea12ac168da84d2e8';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Player mgeb.top
const PLAYER_MOVIE = (tmdbId) => `https://mgeb.top/embed/${tmdbId}`;
const PLAYER_SERIES = (tmdbId, season, episode) => `https://mgeb.top/embed/${tmdbId}/${season}/${episode}`;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const resultsGrid = document.getElementById('resultsGrid');
const videoPlayer = document.getElementById('videoPlayer');
const playerTitle = document.getElementById('playerTitle');
const resultsHeading = document.getElementById('resultsHeading');
const tabMovies = document.getElementById('tabMovies');
const tabSeries = document.getElementById('tabSeries');
const seriesControls = document.getElementById('seriesControls');
const seasonsSlider = document.getElementById('seasonsSlider');
const episodesGrid = document.getElementById('episodesGrid');
const adInterceptor = document.getElementById('ad-interceptor');

let currentTab = 'movies'; // 'movies' or 'series'
let searchTimeout = null;
let currentSeriesDetails = null; // guarda info da série selecionada

// ============================================================
// PROTEÇÃO CONTRA ANÚNCIO DO PRIMEIRO TOQUE + AUTOPLAY
// ============================================================
// O player mgeb.top mostra um anúncio no primeiro clique.
// O overlay captura esse primeiro clique, "engole" o anúncio,
// depois faz o iframe recarregar com autoplay forçado.
let adConsumed = false;

function setupAdProtection() {
  adInterceptor.classList.remove('consumed');
  adConsumed = false;
}

adInterceptor.addEventListener('click', async () => {
  if (adConsumed) return;
  adConsumed = true;
  adInterceptor.classList.add('consumed');
  
  // Recarrega o iframe para pular o anúncio e tocar o vídeo
  const currentSrc = videoPlayer.src;
  if (currentSrc && currentSrc !== 'about:blank') {
    // Força reload do player - a 2ª tentativa já toca sem anúncio
    videoPlayer.src = currentSrc;
    // Tenta forçar autoplay com interação do usuário (clique)
    setTimeout(() => {
      videoPlayer.contentWindow?.postMessage({ event: 'play' }, '*');
    }, 500);
  }
});

// ============================================================
// NAVEGAÇÃO ENTRE TABS (FILMES / SÉRIES)
// ============================================================
tabMovies.addEventListener('click', () => switchTab('movies'));
tabSeries.addEventListener('click', () => switchTab('series'));

function switchTab(tab) {
  currentTab = tab;
  tabMovies.classList.toggle('active', tab === 'movies');
  tabSeries.classList.toggle('active', tab === 'series');
  searchInput.placeholder = tab === 'movies' 
    ? 'Buscar filmes no TMDB...' 
    : 'Buscar séries no TMDB...';
  seriesControls.classList.add('hidden');
  currentSeriesDetails = null;
  loadCatalog();
}

// ============================================================
// CARREGA O PLAYER
// ============================================================
function loadPlayer(url, title, isSeries = false) {
  playerTitle.innerHTML = `<span>▶</span> Assistindo: ${title}`;
  videoPlayer.src = url;
  setupAdProtection();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// SÉRIES - TEMPORADAS E EPISÓDIOS
// ============================================================
async function loadSeriesDetails(seriesId) {
  try {
    const res = await fetch(`${TMDB_BASE_URL}/tv/${seriesId}?api_key=${TMDB_API_KEY}&language=pt-BR`);
    const data = await res.json();
    currentSeriesDetails = data;
    seriesControls.classList.remove('hidden');
    
    // Renderiza slider de temporadas
    seasonsSlider.innerHTML = '';
    const seasons = data.seasons.filter(s => s.season_number > 0);
    
    seasons.forEach((season, idx) => {
      const btn = document.createElement('button');
      btn.className = 'flex-shrink-0 px-4 py-2 rounded-lg bg-cyber-bg border border-cyber-border text-sm text-gray-300 hover:border-cyber-accent transition';
      btn.textContent = `Temporada ${season.season_number}`;
      btn.addEventListener('click', () => loadEpisodes(season.season_number));
      seasonsSlider.appendChild(btn);
    });
    
    // Carrega episódios da primeira temporada automaticamente
    if (seasons.length > 0) {
      seasonsSlider.firstChild.classList.add('border-cyber-accent', 'text-cyber-accent');
      await loadEpisodes(seasons[0].season_number);
    }
  } catch (err) {
    console.error('Erro ao carregar detalhes da série:', err);
  }
}

async function loadEpisodes(seasonNumber) {
  if (!currentSeriesDetails) return;
  
  // Marca temporada ativa
  Array.from(seasonsSlider.children).forEach(btn => {
    btn.classList.remove('border-cyber-accent', 'text-cyber-accent');
    if (btn.textContent.includes(`Temporada ${seasonNumber}`)) {
      btn.classList.add('border-cyber-accent', 'text-cyber-accent');
    }
  });
  
  try {
    const res = await fetch(
      `${TMDB_BASE_URL}/tv/${currentSeriesDetails.id}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=pt-BR`
    );
    const data = await res.json();
    
    episodesGrid.innerHTML = '';
    data.episodes.forEach(ep => {
      const btn = document.createElement('button');
      btn.className = 'episode-card px-2 py-3 rounded-lg bg-cyber-bg border border-cyber-border text-xs text-gray-300 hover:border-cyber-accent transition text-center';
      btn.innerHTML = `<div class="font-bold">Ep ${ep.episode_number}</div><div class="truncate text-[10px] mt-1" title="${ep.name || ''}">${ep.name || ''}</div>`;
      
      btn.addEventListener('click', () => {
        // Marca o episódio ativo
        document.querySelectorAll('.episode-card').forEach(c => c.classList.remove('active-ep'));
        btn.classList.add('active-ep');
        
        const url = PLAYER_SERIES(currentSeriesDetails.id, seasonNumber, ep.episode_number);
        loadPlayer(url, `${currentSeriesDetails.name} - S${seasonNumber}E${ep.episode_number}`, true);
      });
      
      episodesGrid.appendChild(btn);
    });
  } catch (err) {
    console.error('Erro ao carregar episódios:', err);
  }
}

// ============================================================
// CATÁLOGO TMDB (FILMES + SÉRIES)
// ============================================================
async function loadCatalog(query = '') {
  let endpoint;
  if (query) {
    endpoint = currentTab === 'movies'
      ? `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=pt-BR`
      : `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=pt-BR`;
  } else {
    endpoint = currentTab === 'movies'
      ? `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=pt-BR`
      : `${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}&language=pt-BR`;
  }
  
  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    renderCatalog(data.results || []);
  } catch (err) {
    console.error('Erro ao buscar no TMDB:', err);
  }
}

function renderCatalog(items) {
  resultsGrid.innerHTML = '';
  
  if (items.length === 0) {
    resultsGrid.innerHTML = '<p class="col-span-full text-gray-500">Nenhum resultado encontrado.</p>';
    return;
  }
  
  items.forEach(item => {
    if (!item.poster_path) return;
    
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
    const tmdbId = item.id;
    
    const card = document.createElement('div');
    card.className = 'bg-cyber-card border border-cyber-border rounded-lg overflow-hidden cursor-pointer hover:border-cyber-accent transition group flex flex-col';
    
    card.innerHTML = `
      <div class="aspect-[2/3] w-full overflow-hidden bg-gray-900">
        <img 
          src="${IMAGE_BASE_URL}${item.poster_path}" 
          alt="${title}" 
          class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          loading="lazy"
        />
      </div>
      <div class="p-3 flex-1 flex flex-col justify-between">
        <h4 class="text-sm font-semibold text-white truncate">${title}</h4>
        <span class="text-xs text-gray-400 mt-1">${year}</span>
      </div>
    `;
    
    card.addEventListener('click', () => {
      if (currentTab === 'movies') {
        const url = PLAYER_MOVIE(tmdbId);
        loadPlayer(url, title);
      } else {
        // Para séries, abre o player no S1E1 e carrega o seletor
        const url = PLAYER_SERIES(tmdbId, 1, 1);
        loadPlayer(url, `${title} - S1E1`, true);
        loadSeriesDetails(tmdbId);
      }
    });
    
    resultsGrid.appendChild(card);
  });
}

// ============================================================
// BUSCA COM DEBOUNCE
// ============================================================
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();
  
  searchTimeout = setTimeout(() => {
    const label = currentTab === 'movies' ? 'Filmes' : 'Séries';
    resultsHeading.textContent = query ? `Resultados para "${query}"` : `${label} Populares no TMDB`;
    loadCatalog(query);
  }, 400);
});

// ============================================================
// INICIALIZAÇÃO
// ============================================================
loadCatalog();
