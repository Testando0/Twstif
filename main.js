const TMDB_API_KEY = '8265bd1679663a7ea12ac168da84d2e8';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

const PLAYER_MOVIE = (tmdbId) => `https://mgeb.top/embed/${tmdbId}`;
const PLAYER_SERIES = (tmdbId, season, episode) => `https://mgeb.top/embed/${tmdbId}/${season}/${episode}`;

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

let currentTab = 'movies';
let searchTimeout = null;
let currentSeriesDetails = null;

// ============================================================
// BLOQUEIO DE REDIRECIONAMENTOS (SEM QUEBRAR O JS)
// ============================================================
const originalWindowOpen = window.open;
let blockRedirects = false;

// Bloqueia window.open
window.open = function() {
  if (blockRedirects) {
    console.log('🚫 Popup bloqueado:', arguments);
    return null;
  }
  return originalWindowOpen.apply(window, arguments);
};

// Bloqueia redirecionamentos via location.href (setter)
let currentHref = window.location.href;
const locationDescriptor = Object.getOwnPropertyDescriptor(window.location.__proto__, 'href') || 
                           Object.getOwnPropertyDescriptor(Location.prototype, 'href');

if (locationDescriptor && locationDescriptor.set) {
  const originalSet = locationDescriptor.set;
  Object.defineProperty(window.location, 'href', {
    get: locationDescriptor.get ? locationDescriptor.get.bind(window.location) : function() { return currentHref; },
    set: function(val) {
      if (blockRedirects) {
        console.log('🚫 Redirecionamento bloqueado:', val);
        return;
      }
      originalSet.call(window.location, val);
    },
    configurable: true
  });
}

// Bloqueia beforeunload
window.addEventListener('beforeunload', (e) => {
  if (blockRedirects) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});

// ============================================================
// PROTEÇÃO CONTRA ANÚNCIO
// ============================================================
let adConsumed = false;

function setupAdProtection() {
  adInterceptor.classList.remove('consumed');
  videoPlayer.classList.remove('unlocked');
  adConsumed = false;
  blockRedirects = true;
}

adInterceptor.addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  
  if (adConsumed) return;
  adConsumed = true;
  
  console.log('🛡️ Primeiro clique consumido - anúncio bloqueado');
  
  adInterceptor.classList.add('consumed');
  
  const currentSrc = videoPlayer.src;
  if (currentSrc && currentSrc !== 'about:blank') {
    videoPlayer.src = 'about:blank';
    await new Promise(resolve => setTimeout(resolve, 100));
    videoPlayer.src = currentSrc;
  }
  
  setTimeout(() => {
    videoPlayer.classList.add('unlocked');
    
    setTimeout(() => {
      blockRedirects = false;
      console.log('✅ Bloqueio de redirecionamento desativado');
    }, 5000);
    
    try {
      videoPlayer.contentWindow?.postMessage({ event: 'play' }, '*');
    } catch (err) {
      console.log('Autoplay postMessage failed:', err);
    }
  }, 500);
});

videoPlayer.addEventListener('click', (e) => {
  if (!adConsumed) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }
});

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
      btn.innerHTML = `<div class="font-bold">Ep ${ep.episode_number}</div><div class="truncate text-[10px] mt-1" title="${ep.name || ''}">${ep.name || ''}</div>`;
      
      btn.addEventListener('click', () => {
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
        const url = PLAYER_SERIES(tmdbId, 1, 1);
        loadPlayer(url, `${title} - S1E1`, true);
        loadSeriesDetails(tmdbId);
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
