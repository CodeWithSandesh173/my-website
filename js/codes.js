// ========================================
// CODES.JS - Code Snippets Management
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initCodes();
});

let currentUser = null;
let isAdmin = false;

function initCodes() {
    // Wait for Firebase Auth
    const checkAuth = setInterval(async () => {
        if (window.firebaseAuth && window.firebaseDatabase) {
            clearInterval(checkAuth);
            
            window.firebaseAuth.onAuthStateChanged(async (user) => {
                currentUser = user;
                if (user) {
                    isAdmin = await window.isOwner(user);
                    if (isAdmin) {
                        document.getElementById('adminControls').style.display = 'block';
                    }
                } else {
                    isAdmin = false;
                    document.getElementById('adminControls').style.display = 'none';
                }
                
                // Load posts after knowing auth state (for like status etc)
                loadPosts();
            });
            
            // Init Form
            const form = document.getElementById('postForm');
            if (form) form.addEventListener('submit', handlePostSubmit);
        }
    }, 100);
}

// ========================================
// LOAD POSTS
// ========================================
function loadPosts() {
    const codesGrid = document.getElementById('codesGrid');
    const codesRef = window.firebaseDatabase.ref('codes');

    codesRef.on('value', (snapshot) => {
        const data = snapshot.val();
        codesGrid.innerHTML = '';

        if (!data) {
            codesGrid.innerHTML = `
                <div class="text-center text-secondary" style="grid-column: 1/-1; padding: 3rem;">
                    <i class="fas fa-code fa-3x mb-md" style="opacity:0.3"></i>
                    <p>No code snippets yet.</p>
                </div>
            `;
            return;
        }

        // Convert object to array and reverse (newest first)
        const posts = Object.entries(data).map(([key, value]) => ({ id: key, ...value })).reverse();

        posts.forEach(post => {
            const card = createPostCard(post);
            codesGrid.appendChild(card);
        });
        
        // Re-run Prism highlight
        Prism.highlightAll();
    });
}

function createPostCard(post) {
    const div = document.createElement('div');
    div.className = 'card card-glow mb-xl';
    
    // Check if liked by current user
    let isLiked = false;
    let likeCount = 0;
    if (post.likes) {
        likeCount = Object.keys(post.likes).length;
        if (currentUser && post.likes[currentUser.uid]) {
            isLiked = true;
        }
    }
    
    // Comments count
    let commentCount = post.comments ? Object.keys(post.comments).length : 0;
    
    // Date formatting
    const date = new Date(post.timestamp).toLocaleDateString();

    div.innerHTML = `
        <div class="flex justify-between items-start mb-md" style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
                <h3 class="mb-xs">${escapeHtml(post.title)}</h3>
                <div class="flex gap-sm text-sm text-secondary" style="display:flex; gap:10px; font-size:0.85rem;">
                    <span class="badge ${getLangBadgeClass(post.language)}">${post.language}</span>
                    <span><i class="far fa-calendar"></i> ${date}</span>
                </div>
            </div>
            ${isAdmin ? `
                <div class="admin-actions">
                    <button class="btn-outline btn-sm" onclick="editPost('${post.id}')" style="padding: 5px 10px; font-size: 0.8rem;"><i class="fas fa-edit"></i></button>
                    <button class="btn-outline btn-sm" onclick="deletePost('${post.id}')" style="padding: 5px 10px; font-size: 0.8rem; color:var(--accent-error); border-color:var(--accent-error)"><i class="fas fa-trash"></i></button>
                </div>
            ` : ''}
        </div>

        <p class="text-secondary mb-md">${escapeHtml(post.description)}</p>

        <div class="code-preview mb-md" style="position:relative;">
            <button class="copy-btn" onclick="copyCode(this)" style="position:absolute; right:10px; top:10px; padding:5px 10px; background:rgba(255,255,255,0.1); border:none; border-radius:4px; color:#fff; cursor:pointer; font-size:0.8rem; z-index:10;">
                <i class="far fa-copy"></i>
            </button>
            <pre><code class="language-${post.language}">${escapeHtml(post.code)}</code></pre>
        </div>

        <div class="flex gap-lg items-center pt-md" style="display:flex; gap:20px; border-top:1px solid var(--border-color); padding-top:1rem;">
            <button class="action-btn ${isLiked ? 'active' : ''}" onclick="toggleLike('${post.id}')" style="${isLiked ? 'color:var(--accent-tertiary);' : 'color:var(--text-secondary);'}">
                <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> ${likeCount}
            </button>
            <button class="action-btn" onclick="toggleComments('${post.id}')" style="color:var(--text-secondary);">
                <i class="far fa-comment"></i> ${commentCount}
            </button>
        </div>
        
        <!-- Comments Section -->
        <div id="comments-${post.id}" class="comments-section" style="display:none; margin-top:1rem; padding-top:1rem; border-top:1px dashed var(--border-color);">
            <div id="comments-list-${post.id}" class="mb-md"></div>
            
            ${currentUser ? `
                <div class="flex gap-sm" style="display:flex; gap:10px;">
                    <input type="text" id="comment-input-${post.id}" class="form-input" placeholder="Write a comment..." style="padding:8px;">
                    <button class="btn btn-primary" onclick="postComment('${post.id}')" style="padding:8px 15px;"><i class="fas fa-paper-plane"></i></button>
                </div>
            ` : `<p class="text-sm text-secondary">Please <a href="login.html" style="color:var(--accent-primary)">login</a> to comment.</p>`}
        </div>
    `;

    // Load comments if already expanded (omitted for simplicity, default collapsed)
    
    return div;
}

// ========================================
// ACTIONS
// ========================================

async function toggleLike(postId) {
    if (!currentUser) return showToast('Please login to like', 'error');
    
    const uid = currentUser.uid;
    const likeRef = window.firebaseDatabase.ref(`codes/${postId}/likes/${uid}`);
    
    try {
        const snapshot = await likeRef.once('value');
        if (snapshot.exists()) {
            await likeRef.remove();
        } else {
            await likeRef.set(Date.now());
        }
    } catch (error) {
        showToast('Error liking post', 'error');
    }
}

function toggleComments(postId) {
    const el = document.getElementById(`comments-${postId}`);
    if (el.style.display === 'none') {
        el.style.display = 'block';
        loadComments(postId);
    } else {
        el.style.display = 'none';
    }
}

function loadComments(postId) {
    const list = document.getElementById(`comments-list-${postId}`);
    const commentsRef = window.firebaseDatabase.ref(`codes/${postId}/comments`);
    
    commentsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            list.innerHTML = '<p class="text-sm text-secondary">No comments yet.</p>';
            return;
        }
        
        list.innerHTML = Object.values(data).map(c => `
            <div class="comment mb-sm" style="background:var(--bg-secondary); padding:8px; border-radius:var(--radius-sm);">
                <div class="flex justify-between" style="display:flex; justify-content:space-between; font-size:0.8rem;">
                    <span style="font-weight:bold; color:var(--accent-secondary);">${escapeHtml(c.username)}</span>
                    <span class="text-muted">${new Date(c.timestamp).toLocaleDateString()}</span>
                </div>
                <p class="text-sm mt-xs">${escapeHtml(c.text)}</p>
            </div>
        `).join('');
    });
}

async function postComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    if (!text) return;
    
    try {
        const username = await window.getUsername(currentUser.uid);
        await window.firebaseDatabase.ref(`codes/${postId}/comments`).push({
            text: text,
            uid: currentUser.uid,
            username: username,
            timestamp: Date.now()
        });
        input.value = '';
    } catch (error) {
        showToast('Error posting comment', 'error');
    }
}

async function handlePostSubmit(e) {
    e.preventDefault();
    if (!isAdmin) return;

    const id = document.getElementById('postId').value;
    const title = document.getElementById('postTitle').value;
    const lang = document.getElementById('postLang').value;
    const desc = document.getElementById('postDesc').value;
    const code = document.getElementById('postCode').value;

    const data = {
        title,
        language: lang,
        description: desc,
        code: code,
        timestamp: Date.now(),
        author: 'Sandesh'
    };

    try {
        if (id) {
            // Update
            await window.firebaseDatabase.ref(`codes/${id}`).update(data);
            showToast('Post updated!', 'success');
        } else {
            // New
            await window.firebaseDatabase.ref('codes').push(data);
            showToast('Post created!', 'success');
        }
        closePostModal();
        e.target.reset();
    } catch (error) {
        showToast('Error saving post', 'error');
        console.error(error);
    }
}

async function deletePost(postId) {
    if (!isAdmin) return;
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    try {
        await window.firebaseDatabase.ref(`codes/${postId}`).remove();
        showToast('Post deleted', 'success');
    } catch (error) {
        showToast('Error deleting post', 'error');
    }
}

function editPost(postId) {
    const postRef = window.firebaseDatabase.ref(`codes/${postId}`);
    postRef.once('value').then(snap => {
        const post = snap.val();
        
        document.getElementById('postId').value = postId;
        document.getElementById('postTitle').value = post.title;
        document.getElementById('postLang').value = post.language;
        document.getElementById('postDesc').value = post.description;
        document.getElementById('postCode').value = post.code;
        document.getElementById('modalTitle').textContent = 'Edit Post';
        
        openPostModal();
    });
}

// ========================================
// UI HELPERS
// ========================================

function openPostModal() {
    document.getElementById('postModal').classList.add('active');
}

function closePostModal() {
    document.getElementById('postModal').classList.remove('active');
    document.getElementById('postForm').reset();
    document.getElementById('postId').value = '';
    document.getElementById('modalTitle').textContent = 'New Code Post';
}

function copyCode(btn) {
    const code = btn.nextElementSibling.innerText;
    navigator.clipboard.writeText(code).then(() => {
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => btn.innerHTML = original, 2000);
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getLangBadgeClass(lang) {
    // Return appropriate color class if needed, or just default style
    return 'badge'; 
}

// Close modal on outside click
document.getElementById('postModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('postModal')) {
        closePostModal();
    }
});
