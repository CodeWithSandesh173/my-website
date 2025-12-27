// ========================================
// PAGE-EDITOR.JS - Owner Edit Mode
// ========================================

let isOwnerLoggedIn = false;
let editMode = false;
let pageContent = {};

document.addEventListener('DOMContentLoaded', () => {
    initPageEditor();
});

function initPageEditor() {
    const checkFirebase = setInterval(() => {
        if (window.firebaseAuth && window.firebaseDatabase) {
            clearInterval(checkFirebase);

            window.firebaseAuth.onAuthStateChanged(async (user) => {
                if (user) {
                    isOwnerLoggedIn = await window.isOwner(user);
                    if (isOwnerLoggedIn) {
                        showEditButton();
                        loadPageContent();
                    }
                } else {
                    isOwnerLoggedIn = false;
                    hideEditButton();
                }
            });
        }
    }, 100);

    setTimeout(() => clearInterval(checkFirebase), 5000);
}

// ========================================
// SHOW/HIDE EDIT BUTTON
// ========================================
function showEditButton() {
    if (document.getElementById('ownerEditBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'ownerEditBtn';
    btn.className = 'owner-edit-btn';
    btn.innerHTML = '<i class="fas fa-edit"></i>';
    btn.title = 'Edit Page';
    btn.onclick = toggleEditMode;

    document.body.appendChild(btn);

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
    .owner-edit-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: var(--gradient-primary);
      border: none;
      color: white;
      font-size: 1.2rem;
      cursor: pointer;
      z-index: 9999;
      box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
      transition: all 0.3s;
    }
    .owner-edit-btn:hover {
      transform: scale(1.1);
    }
    .owner-edit-btn.active {
      background: var(--accent-success);
    }
    .editable {
      outline: 2px dashed var(--accent-primary);
      outline-offset: 4px;
      cursor: text;
    }
    .editable:hover {
      outline-color: var(--accent-secondary);
    }
    .editable:focus {
      outline-style: solid;
      background: rgba(139, 92, 246, 0.1);
    }
    .save-indicator {
      position: fixed;
      bottom: 80px;
      right: 20px;
      padding: 0.75rem 1.5rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      z-index: 9998;
      display: none;
    }
    .save-indicator.show {
      display: block;
    }
  `;
    document.head.appendChild(style);

    // Add save indicator
    const indicator = document.createElement('div');
    indicator.id = 'saveIndicator';
    indicator.className = 'save-indicator';
    indicator.innerHTML = '<i class="fas fa-save"></i> Changes saved';
    document.body.appendChild(indicator);
}

function hideEditButton() {
    const btn = document.getElementById('ownerEditBtn');
    if (btn) btn.remove();
}

// ========================================
// TOGGLE EDIT MODE
// ========================================
function toggleEditMode() {
    editMode = !editMode;
    const btn = document.getElementById('ownerEditBtn');

    if (editMode) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fas fa-check"></i>';
        btn.title = 'Save & Exit';
        enableEditing();
        showToast('Edit mode ON - Click text to edit', 'success');
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fas fa-edit"></i>';
        btn.title = 'Edit Page';
        disableEditing();
        savePageContent();
        showToast('Changes saved!', 'success');
    }
}

// ========================================
// ENABLE/DISABLE EDITING
// ========================================
function enableEditing() {
    // Make specific elements editable
    const editableSelectors = [
        'h1', 'h2', 'h3', 'h4',
        '.hero-title', '.hero-subtitle',
        '.section-title', '.section-subtitle',
        '.card-title', '.card-description',
        '.contact-text', '.about-text',
        'p.text-secondary'
    ];

    editableSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach((el, index) => {
            // Skip navigation and footer
            if (el.closest('nav') || el.closest('footer') || el.closest('.auth-card')) return;

            const editId = `edit-${selector.replace(/[^a-z]/g, '')}-${index}`;
            el.dataset.editId = editId;
            el.classList.add('editable');
            el.contentEditable = true;
            el.spellcheck = false;

            // Save on blur
            el.addEventListener('blur', () => {
                if (editMode) {
                    saveElementContent(editId, el.innerHTML);
                }
            });
        });
    });
}

function disableEditing() {
    document.querySelectorAll('.editable').forEach(el => {
        el.classList.remove('editable');
        el.contentEditable = false;
    });
}

// ========================================
// SAVE CONTENT
// ========================================
function saveElementContent(editId, content) {
    const pageName = getPageName();
    pageContent[editId] = content;

    // Auto-save to database
    window.firebaseDatabase.ref('pageContent/' + pageName + '/' + editId).set(content);

    // Show save indicator
    const indicator = document.getElementById('saveIndicator');
    if (indicator) {
        indicator.classList.add('show');
        setTimeout(() => indicator.classList.remove('show'), 2000);
    }
}

function savePageContent() {
    const pageName = getPageName();

    document.querySelectorAll('[data-edit-id]').forEach(el => {
        pageContent[el.dataset.editId] = el.innerHTML;
    });

    window.firebaseDatabase.ref('pageContent/' + pageName).set(pageContent);
}

// ========================================
// LOAD CONTENT
// ========================================
async function loadPageContent() {
    const pageName = getPageName();

    try {
        const snapshot = await window.firebaseDatabase.ref('pageContent/' + pageName).once('value');
        const data = snapshot.val();

        if (data) {
            pageContent = data;

            // Wait for DOM to be ready
            setTimeout(() => {
                applyLoadedContent();
            }, 500);
        }
    } catch (error) {
        console.error('Error loading page content:', error);
    }
}

function applyLoadedContent() {
    // Apply saved content to elements
    const editableSelectors = [
        'h1', 'h2', 'h3', 'h4',
        '.hero-title', '.hero-subtitle',
        '.section-title', '.section-subtitle',
        '.card-title', '.card-description',
        '.contact-text', '.about-text',
        'p.text-secondary'
    ];

    editableSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach((el, index) => {
            if (el.closest('nav') || el.closest('footer') || el.closest('.auth-card')) return;

            const editId = `edit-${selector.replace(/[^a-z]/g, '')}-${index}`;

            if (pageContent[editId]) {
                el.innerHTML = pageContent[editId];
            }
        });
    });
}

// ========================================
// UTILITIES
// ========================================
function getPageName() {
    const path = window.location.pathname;
    const page = path.split('/').pop().replace('.html', '') || 'index';
    return page;
}

// Export
window.toggleEditMode = toggleEditMode;
