const TMDB_API_KEY = '8265bd1679663a7ea12ac168da84d2e8';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// O myembed.biz usa o ID do IMDb (tt...), que buscamos no TMDB via external_ids
const PLAYER_BASE = 'https://myembed.biz';
const PLAYER_MOVIE = (imdbId) => `${PLAYER_BASE}/filme/${imdbId}`;
const PLAYER_SERIES = (imdbId, season, episode) => `${PLAYER_BASE}/serie/${imdbId}/${season}/${episode}`;

// Sandbox: sem allow-popups / allow-top-navigation, o player não consegue
// abrir pop-ups nem redirecionar a página principal.
const PLAYER_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-presentation';

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

let currentTab = 'movies';
let searchTimeout = null;
let currentSeriesDetails = null;
let currentSeriesImdbId = null;

// ============================================================
// NAVEGAÇÃO ENTRE TABS
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
  currentSeriesImdbId = null;
  loadCatalog();
}

// ============================================================
// CARREGA O PLAYER
// ============================================================
function loadPlayer(url, title) {
  playerTitle.innerHTML = `<span>▶</span> Assistindo: ${escapeHtml(title)}`;

  // Garante o sandbox antes de definir o src
  videoPlayer.setAttribute('sandbox', PLAYER_SANDBOX);
  videoPlayer.src = url;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Busca o ID do IMDb no TMDB (type: 'movie' | 'tv')
async function getImdbId(type, tmdbId) {
  try {
    const res = await fetch(`${TMDB_BASE_URL}/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.imdb_id || null;
  } catch (err) {
    console.error('Erro ao buscar IMDb ID:', err);
    return null;
  }
}

function showPlayerError(title) {
  playerTitle.innerHTML = `<span>⚠</span> Sem ID do IMDb para: ${escapeHtml(title)}`;
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ============================================================
// SÉRIES - TEMPORADAS E EPISÓDIOS
// ============================================================
async function loadSeriesDetails(seriesId, imdbId) {
  try {
    const res = await fetch(`${TMDB_BASE_URL}/tv/${seriesId}?api_key=${TMDB_API_KEY}&language=pt-BR`);
    const data = await res.json();
    currentSeriesDetails = data;
    currentSeriesImdbId = imdbId;
    seriesControls.classList.remove('hidden');
    
    seasonsSlider.innerHTML = '';
    const seasons = data.seasons.filter(s => s.season_number > 0);
    
    seasons.forEach((season, idx) => {
      const btn = document.createElement('button');
      btn.className = 'flex-shrink-0 px-4 py-2 rounded-lg bg-cyber-bg border border-cyber-border text-sm text-gray-300 hover:border-cyber-accent transition';
      btn.textContent = `Temporada ${season.season_number}`;
      btn.addEventListener('click', () => loadEpisodes(season.season_number));
      seasonsSlider.appendChild(btn);
    });
    
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
      btn.innerHTML = `<div class="font-bold">Ep ${ep.episode_number}</div><div class="truncate text-[10px] mt-1" title="${escapeHtml(ep.name)}">${escapeHtml(ep.name)}</div>`;
      
      btn.addEventListener('click', () => {
        document.querySelectorAll('.episode-card').forEach(c => c.classList.remove('active-ep'));
        btn.classList.add('active-ep');
        
        const url = PLAYER_SERIES(currentSeriesImdbId, seasonNumber, ep.episode_number);
        loadPlayer(url, `${currentSeriesDetails.name} - S${seasonNumber}E${ep.episode_number}`);
      });
      
      episodesGrid.appendChild(btn);
    });
  } catch (err) {
    console.error('Erro ao carregar episódios:', err);
  }
}

// ============================================================
// CATÁLOGO TMDB
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
    if (!res.ok) {
      console.error('Erro na API TMDB:', res.status, res.statusText);
      resultsGrid.innerHTML = `<p class="col-span-full text-red-500">Erro ao buscar dados do TMDB (${res.status}). Verifique a API key.</p>`;
      return;
    }
    const data = await res.json();
    renderCatalog(data.results || []);
  } catch (err) {
    console.error('Erro ao buscar no TMDB:', err);
    resultsGrid.innerHTML = `<p class="col-span-full text-red-500">Erro de conexão com TMDB: ${err.message}</p>`;
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
          alt="${escapeHtml(title)}" 
          class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          loading="lazy"
        />
      </div>
      <div class="p-3 flex-1 flex flex-col justify-between">
        <h4 class="text-sm font-semibold text-white truncate">${escapeHtml(title)}</h4>
        <span class="text-xs text-gray-400 mt-1">${year}</span>
      </div>
    `;
    
    card.addEventListener('click', async () => {
      const type = currentTab === 'movies' ? 'movie' : 'tv';
      playerTitle.innerHTML = `<span>⏳</span> Carregando: ${escapeHtml(title)}`;

      const imdbId = await getImdbId(type, tmdbId);
      if (!imdbId) {
        showPlayerError(title);
        return;
      }

      if (type === 'movie') {
        loadPlayer(PLAYER_MOVIE(imdbId), title);
      } else {
        currentSeriesImdbId = imdbId;
        loadPlayer(PLAYER_SERIES(imdbId, 1, 1), `${title} - S1E1`);
        loadSeriesDetails(tmdbId, imdbId);
      }
    });

    resultsGrid.appendChild(card);
  });
}

// ============================================================
// BUSCA
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
console.log('🚀 Iniciando CineStream...');
loadCatalog();
