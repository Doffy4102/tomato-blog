let contentData = [];
let currentEditId = null;
let currentTags = [];

// =================================================================
// #region Helper Function
// =================================================================

async function getJsonOrError(response) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return response.json();
    }
    const text = await response.text();
    return { error: { message: text || `Request failed with status ${response.status}` } };
}

// =================================================================
// #region Authentication & Session Management
// =================================================================

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await getJsonOrError(response);
        if (!response.ok) {
            throw new Error(data.error?.message || 'Invalid username or password');
        }
        localStorage.setItem('token', data.token);
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        fetchArticles();
        errorDiv.style.display = 'none';
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    }
}

function logout() {
    localStorage.removeItem('token');
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        fetchArticles();
    }
    const dashboardTab = document.getElementById('dashboardTab');
    const exportImportSection = document.createElement('div');
    exportImportSection.innerHTML = `
        <h3 style="margin: 30px 0 20px;">Data Management</h3>
        <button onclick="exportData()" style="margin-right: 10px;">Export Data</button>
        <input type="file" id="importFile" accept=".json" onchange="importData(event)" style="display: none;">
        <button onclick="document.getElementById('importFile').click()">Import Data</button>
    `;
    dashboardTab.appendChild(exportImportSection);
});

// =================================================================
// #region API Communication (CRUD)
// =================================================================

const fetchArticles = async () => {
    try {
        const response = await fetch('/api/articles?limit=100', { cache: 'no-store' });
        const data = await getJsonOrError(response);
        if (!response.ok) {
            throw new Error(data.error?.message || 'Could not fetch articles.');
        }
        const articles = data.results.map(article => ({
            ...article,
            tags: article.tags ? JSON.parse(article.tags) : []
        }));
        contentData = articles;
        updateDashboard();
        loadContentList();
    } catch (error) {
        console.error('Error fetching articles:', error);
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = `<div class="error-message">Error loading content: ${error.message}</div>`;
        }
    }
};

document.getElementById('contentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
        showMessage('Authentication error. Please log in again.', 'error');
        return;
    }
    const contentItem = {
        title: document.getElementById('title').value,
        category: document.getElementById('category').value,
        description: document.getElementById('description').value,
        readTime: `${document.getElementById('readTime').value} min read`,
        content: document.getElementById('content').value,
        tags: [...currentTags],
        createdAt: currentEditId ? contentData.find(item => item.id === currentEditId).createdAt : new Date().toISOString().split('T')[0],
    };

    try {
        let response;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
        if (currentEditId) {
            response = await fetch(`/api/articles/${currentEditId}`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(contentItem)
            });
        } else {
            response = await fetch('/api/articles', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(contentItem)
            });
        }
        const data = await getJsonOrError(response);
        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to save content');
        }
        const message = currentEditId ? 'Content updated successfully!' : 'Content added successfully!';
        showMessage(message, 'success');
        fetchArticles();
        showTab({ currentTarget: document.querySelector('.tab[onclick*="content"]') }, 'content');
        resetForm();
    } catch (error) {
        console.error('Error saving content:', error);
        showMessage(error.message, 'error');
    }
});

async function deleteContent(id) {
    if (confirm('Are you sure you want to delete this content?')) {
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('Authentication error. Please log in again.', 'error');
            return;
        }
        try {
            const response = await fetch(`/api/articles/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await getJsonOrError(response);
            if (!response.ok && response.status !== 204) { // 204 No Content is a success for DELETE
                throw new Error(data.error?.message || 'Failed to delete content');
            }
            fetchArticles();
            showMessage('Content deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting content:', error);
            showMessage(error.message, 'error');
        }
    }
}

// =================================================================
// #region UI & DOM Manipulation
// =================================================================

function showTab(event, tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
    event.currentTarget.classList.add('active');
}

function updateDashboard() {
    const totalContent = contentData.length;
    const categories = [...new Set(contentData.map(item => item.category))].filter(Boolean);
    const thisMonth = contentData.filter(item => {
        const itemDate = new Date(item.createdAt);
        const now = new Date();
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    }).length;
    document.getElementById('totalContent').textContent = totalContent;
    document.getElementById('totalCategories').textContent = categories.length;
    document.getElementById('recentContent').textContent = thisMonth;
}

function loadContentList() {
    const listContainer = document.getElementById('contentList');
    if (contentData.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No content available.</p>';
        return;
    }
    listContainer.innerHTML = contentData.map(item => `
        <div class="content-item">
            <h3>${item.title}</h3>
            <div class="content-meta">
                <span>📂 ${item.category || 'No Category'}</span> • 
                <span>📅 ${item.createdAt}</span> • 
                <span>⏱️ ${item.readTime}</span>
            </div>
            <p>${item.description || ''}</p>
            <div class="content-actions">
                <button onclick="editContent(${item.id})">Edit</button>
                <button class="btn-danger" onclick="deleteContent(${item.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function editContent(id) {
    const content = contentData.find(item => item.id === id);
    if (!content) return;
    currentEditId = id;
    document.getElementById('title').value = content.title;
    document.getElementById('category').value = content.category;
    document.getElementById('description').value = content.description;
    document.getElementById('readTime').value = parseInt(content.readTime) || 0;
    document.getElementById('content').value = content.content;
    currentTags = [...(content.tags || [])];
    updateTagsDisplay();
    showTab({ currentTarget: document.querySelector('.tab[onclick*="add"]') }, 'add');
    document.querySelector('#addTab h2').textContent = 'Edit Content';
    document.querySelector('#addTab button[type="submit"]').textContent = 'Update Content';
}

function resetForm() {
    document.getElementById('contentForm').reset();
    currentTags = [];
    currentEditId = null;
    updateTagsDisplay();
    document.querySelector('#addTab h2').textContent = 'Add New Content';
    document.querySelector('#addTab button[type="submit"]').textContent = 'Add Content';
    document.getElementById('messages').innerHTML = '';
}

function showMessage(message, type) {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.innerHTML = `<div class="${type}-message">${message}</div>`;
    setTimeout(() => {
        messagesDiv.innerHTML = '';
    }, 4000);
}

// =================================================================
// #region Tagging Functionality
// =================================================================

function updateTagsDisplay() {
    const container = document.getElementById('tagsContainer');
    const tagInput = document.getElementById('tagInput');
    while (container.firstChild && container.firstChild !== tagInput) {
        container.removeChild(container.firstChild);
    }
    currentTags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.className = 'tag';
        tagElement.innerHTML = `${tag} <span class="tag-remove" onclick="removeTag('${tag}')">×</span>`;
        container.insertBefore(tagElement, tagInput);
    });
}

function addTag(tag) {
    tag = tag.trim().toLowerCase();
    if (tag && !currentTags.includes(tag)) {
        currentTags.push(tag);
        updateTagsDisplay();
    }
    document.getElementById('tagInput').value = '';
}

function removeTag(tag) {
    currentTags = currentTags.filter(t => t !== tag);
    updateTagsDisplay();
}

document.getElementById('tagInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addTag(e.target.value);
    }
});

// =================================================================
// #region Data Import/Export
// =================================================================

function exportData() {
    if (contentData.length === 0) {
        alert("No content to export.");
        return;
    }
    const dataStr = JSON.stringify(contentData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tomatoengg_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async function (e) {
            if (!confirm("This may create duplicate content. Are you sure you want to proceed?")) {
                return;
            }
            try {
                const importedData = JSON.parse(e.target.result);
                for (const article of importedData) {
                    const { id, ...articleToPost } = article;
                    await fetch('/api/articles', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify(articleToPost)
                    });
                }
                fetchArticles();
                showMessage('Data imported successfully!', 'success');
            } catch (error) {
                showMessage('Error importing data. Check file format.', 'error');
            }
        };
        reader.readAsText(file);
    }
}