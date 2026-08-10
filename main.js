const TMDB_API_KEY = 'YOUR_TMDB_API_KEY'; // Insira sua chave da API do TMDB aqui
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Provedor de embed limpo sem marcas de água
const EMBED_BASE_URL = 'https://embed.su/embed/movie/';

const searchInput = document.getElementById('searchInput');
const resultsGrid = document.getElementById('resultsGrid');
const videoPlayer = document.getElementById('videoPlayer');
const playerTitle = document.getElementById('playerTitle');
const resultsHeading = document.getElementById('resultsHeading');

let searchTimeout = null;

// Atualiza o player de vídeo com base no ID do TMDB
function loadMovie(tmdbId, title) {
  videoPlayer.src = `${EMBED_BASE_URL}${tmdbId}`;
  playerTitle.innerHTML = `<span>▶</span> Assistindo: ${title}`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Busca filmes via API do TMDB
async function fetchMovies(query = '') {
  const endpoint = query 
    ? `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=pt-BR`
    : `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=pt-BR`;

  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    renderMovies(data.results || []);
  } catch (err) {
    console.error('Erro ao buscar dados do TMDB:', err);
  }
}

// Renderiza a lista de filmes
function renderMovies(movies) {
  resultsGrid.innerHTML = '';

  if (movies.length === 0) {
    resultsGrid.innerHTML = '<p class="col-span-full text-gray-500">Nenhum filme encontrado.</p>';
    return;
  }

  movies.forEach(movie => {
    if (!movie.poster_path) return;

    const card = document.createElement('div');
    card.className = 'bg-cyber-card border border-cyber-border rounded-lg overflow-hidden cursor-pointer hover:border-cyber-accent transition group flex flex-col';
    
    card.innerHTML = `
      <div class="aspect-[2/3] w-full overflow-hidden bg-gray-900">
        <img 
          src="${IMAGE_BASE_URL}${movie.poster_path}" 
          alt="${movie.title}" 
          class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          loading="lazy"
        />
      </div>
      <div class="p-3 flex-1 flex flex-col justify-between">
        <h4 class="text-sm font-semibold text-white truncate">${movie.title}</h4>
        <span class="text-xs text-gray-400 mt-1">${movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</span>
      </div>
    `;

    card.addEventListener('click', () => loadMovie(movie.id, movie.title));
    resultsGrid.appendChild(card);
  });
}

// Escuta a busca com debounce
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();

  searchTimeout = setTimeout(() => {
    resultsHeading.textContent = query ? `Resultados para "${query}"` : 'Filmes Populares';
    fetchMovies(query);
  }, 400);
});

// Inicialização
fetchMovies();
