let allArticles = [];
let filteredArticles = [];

// =================================================================
// #region Data Fetching and Rendering
// =================================================================

/**
 * Fetches the initial set of articles from the server.
 */
const fetchArticles = async () => {
    try {
        const response = await fetch('/api/articles?limit=6');
        const data = await response.json();

        // The API already sorts by date, but we re-sort by ID as a fallback to ensure newest is first.
        data.results.sort((a, b) => b.id - a.id);

        allArticles = data.results;
        filteredArticles = [...allArticles];
        renderArticles(filteredArticles);
    } catch (error) {
        console.error('Error fetching articles:', error);
    }
};

/**
 * Infers a semester tag based on keywords in the article's category.
 * @param {object} article - The article object.
 * @returns {string|null} The inferred semester or null.
 */
function getSemester(article) {
    if (article.semester) return article.semester; // If a semester is explicitly set

    // Infer based on category content
    const category = article.category.toLowerCase();
    if (category.includes('basic') || category.includes('fundamental')) return 'Sem 1';
    if (category.includes('data structure')) return 'Sem 4';
    if (category.includes('database')) return 'Sem 5';
    if (category.includes('advanced')) return 'Sem 6';

    return null; // No default semester if no keywords match
}

/**
 * Renders a list of articles to the page.
 * @param {Array<object>} articles - The array of article objects to render.
 */
function renderArticles(articles) {
    const grid = document.getElementById('articlesGrid');
    const noResults = document.getElementById('noResults');

    if (!grid) return; // Exit if the grid element isn't on the page

    if (articles.length === 0) {
        grid.innerHTML = '';
        if(noResults) noResults.style.display = 'block';
        return;
    }

    if(noResults) noResults.style.display = 'none';

    grid.innerHTML = articles.map(article => {
        // Safely parse tags, defaulting to an empty array
        const tags = Array.isArray(article.tags) ? article.tags : (typeof article.tags === 'string' ? JSON.parse(article.tags) : []);
        
        return `
            <div class="article-card" onclick="window.location.href='/article/${article.id}'">
                <div class="article-header">
                    <h3 class="article-title">${article.title}</h3>
                    ${getSemester(article) ? `<span class="semester-tag">${getSemester(article)}</span>` : ''}
                </div>
                <div class="article-meta">
                    <span class="subject-name">📖 ${article.category}</span>
                    <span class="read-time">⏱️ ${article.readTime}</span>
                </div>
                <p class="article-description">${article.description}</p>
                <div class="article-tags">
                    ${tags.slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('')}
                    ${tags.length > 3 ? `<span class="tag">+${tags.length - 3} more</span>` : ''}
                </div>
                <a href="/article/${article.id}" class="read-more">
                    Read More →
                </a>
            </div>
        `;
    }).join('');
}


// =================================================================
// #region Search Functionality
// =================================================================

/**
 * Fetches all articles and filters them based on the search query.
 */
async function performSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();

    // If the search query is cleared, revert to the initial fetched list
    if (!query) {
        filteredArticles = [...allArticles];
        renderArticles(filteredArticles);
        return;
    }

    try {
        // Fetch all articles to search through the entire database
        const response = await fetch('/api/articles?limit=1000'); // Limit to 1000 for performance
        const data = await response.json();
        let allArticlesForSearch = data.results;

        // Sort all articles before filtering to maintain newest-first order
        allArticlesForSearch.sort((a, b) => b.id - a.id);

        filteredArticles = allArticlesForSearch.filter(article => {
             const tags = Array.isArray(article.tags) ? article.tags : (typeof article.tags === 'string' ? JSON.parse(article.tags) : []);
             return (
                article.title.toLowerCase().includes(query) ||
                article.category.toLowerCase().includes(query) ||
                article.description.toLowerCase().includes(query) ||
                tags.some(tag => tag.toLowerCase().includes(query)) ||
                (getSemester(article) && getSemester(article).toLowerCase().includes(query))
             );
        });

        renderArticles(filteredArticles);
    } catch (error) {
        console.error('Error fetching articles for search:', error);
    }
}

// Attach event listeners for search
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission
            performSearch();
        }
    });
}


// =================================================================
// #region Initialization
// =================================================================

// Fetch articles when the page loads
document.addEventListener('DOMContentLoaded', fetchArticles);