// ========================================
// REVIEWS.JS - Reviews with Profile Pictures & Fixed Dates
// ========================================

let reviewsCache = [];
let currentUser = null;
let isOwnerUser = false;
let currentUsername = '';
let editingReviewId = null;

document.addEventListener('DOMContentLoaded', () => {
    initReviews();
});

function initReviews() {
    const checkFirebase = setInterval(() => {
        if (window.firebaseAuth && window.firebaseDatabase) {
            clearInterval(checkFirebase);

            window.firebaseAuth.onAuthStateChanged(async (user) => {
                currentUser = user;

                if (user) {
                    currentUsername = await window.getUsername(user.uid);
                    isOwnerUser = await window.isOwner(user);
                } else {
                    currentUsername = '';
                    isOwnerUser = false;
                }

                updateReviewForm(user);
                loadReviews();
            });

            const reviewForm = document.getElementById('reviewForm');
            if (reviewForm) {
                reviewForm.addEventListener('submit', submitReview);
            }
        }
    }, 100);

    setTimeout(() => clearInterval(checkFirebase), 5000);
}

// ========================================
// UPDATE REVIEW FORM
// ========================================
async function updateReviewForm(user) {
    const reviewFormSection = document.getElementById('reviewFormSection');
    const loginPrompt = document.getElementById('loginPrompt');
    const reviewerNameDisplay = document.getElementById('reviewerNameDisplay');

    if (user && user.emailVerified) {
        if (reviewFormSection) reviewFormSection.style.display = 'block';
        if (loginPrompt) loginPrompt.style.display = 'none';

        if (reviewerNameDisplay) {
            reviewerNameDisplay.textContent = (user.displayName || 'User') + ' (@' + currentUsername + ')';
        }
    } else if (user && !user.emailVerified) {
        if (reviewFormSection) reviewFormSection.style.display = 'none';
        if (loginPrompt) {
            loginPrompt.style.display = 'block';
            loginPrompt.innerHTML = `
        <p class="text-secondary">Please verify your email to leave a review.</p>
        <a href="login.html" class="btn btn-outline" style="margin-top: 1rem;">
          <i class="fas fa-envelope"></i> Check Account
        </a>
      `;
        }
    } else {
        if (reviewFormSection) reviewFormSection.style.display = 'none';
        if (loginPrompt) {
            loginPrompt.style.display = 'block';
            loginPrompt.innerHTML = `
        <p class="text-secondary">Login to share your thoughts!</p>
        <a href="login.html" class="btn btn-primary" style="margin-top: 1rem;">
          <i class="fas fa-sign-in-alt"></i> Login / Sign Up
        </a>
      `;
        }
    }
}

// ========================================
// LOAD REVIEWS
// ========================================
function loadReviews() {
    const reviewsRef = window.firebaseDatabase.ref('reviews');

    reviewsRef.orderByChild('timestamp').on('value', (snapshot) => {
        reviewsCache = [];
        snapshot.forEach((child) => {
            reviewsCache.push({
                id: child.key,
                ...child.val()
            });
        });

        reviewsCache.reverse();
        renderReviews();
    });
}

// ========================================
// RENDER REVIEWS
// ========================================
function renderReviews() {
    const reviewsList = document.getElementById('reviewsList');
    const noReviews = document.getElementById('noReviews');

    if (!reviewsList) return;

    reviewsList.innerHTML = '';

    if (reviewsCache.length === 0) {
        if (noReviews) noReviews.style.display = 'block';
        return;
    }

    if (noReviews) noReviews.style.display = 'none';

    reviewsCache.forEach(review => {
        createReviewCard(review).then(card => {
            reviewsList.appendChild(card);
        });
    });
}

// ========================================
// CREATE REVIEW CARD
// ========================================
async function createReviewCard(review) {
    const card = document.createElement('div');
    card.className = 'review-card';
    card.dataset.id = review.id;

    const name = review.name || 'User';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    const date = formatDate(review.timestamp);
    const rating = review.rating || 5;

    // Get profile picture
    let avatarContent = initials;
    if (review.userId) {
        try {
            const snapshot = await window.firebaseDatabase.ref('users/' + review.userId + '/profilePic').once('value');
            const profilePic = snapshot.val();
            if (profilePic) {
                avatarContent = `<img src="${profilePic}" style="width: 100%; height: 100%; object-fit: cover;">`;
            }
        } catch (e) { }
    }

    let stars = '';
    for (let i = 1; i <= 5; i++) {
        stars += `<i class="fas fa-star" style="color: ${i <= rating ? '#fbbf24' : 'var(--text-tertiary)'};"></i>`;
    }

    const isOwnReview = currentUser && review.userId === currentUser.uid;
    const showEdit = false; // Users cannot edit
    const showDelete = isOwnerUser; // Only owner can delete

    const isImgAvatar = avatarContent.includes('<img');

    card.innerHTML = `
    <div class="review-header">
      <div class="review-author">
        <div class="author-avatar">${isImgAvatar ? avatarContent : initials}</div>
        <div>
          <h4>${escapeHtml(name)}</h4>
          <span class="review-date">@${escapeHtml(review.username || 'user')} • ${date}</span>
        </div>
      </div>
      <div class="review-rating">${stars}</div>
    </div>
    <p class="review-text">${escapeHtml(review.text)}</p>
    ${(showEdit || showDelete) ? `
      <div class="review-controls">
        ${showEdit ? `<button onclick="editReview('${review.id}')" class="control-btn edit"><i class="fas fa-edit"></i> Edit</button>` : ''}
        ${showDelete ? `<button onclick="deleteReview('${review.id}')" class="control-btn delete"><i class="fas fa-trash"></i> Delete</button>` : ''}
      </div>
    ` : ''}
  `;

    return card;
}

// ========================================
// SUBMIT REVIEW
// ========================================
async function submitReview(e) {
    e.preventDefault();

    if (!currentUser || !currentUser.emailVerified) {
        showToast('Please login and verify your email', 'error');
        return;
    }

    const textInput = document.getElementById('reviewText');
    const ratingInputs = document.querySelectorAll('input[name="rating"]');
    const submitBtn = document.getElementById('submitReviewBtn');

    const text = textInput.value.trim();
    let rating = 5;

    ratingInputs.forEach(input => {
        if (input.checked) rating = parseInt(input.value);
    });

    if (!text) {
        showToast('Please write your review', 'error');
        return;
    }

    if (text.length < 10) {
        showToast('Review must be at least 10 characters', 'error');
        return;
    }

    submitBtn.disabled = true;

    try {
        if (editingReviewId) {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

            await window.firebaseDatabase.ref('reviews/' + editingReviewId).update({
                text: text,
                rating: rating,
                editedAt: Date.now()
            });

            showToast('Review updated!', 'success');
            cancelEdit();
        } else {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';

            const reviewData = {
                name: currentUser.displayName || 'User',
                username: currentUsername,
                text: text,
                rating: rating,
                timestamp: Date.now(),
                userId: currentUser.uid
            };

            await window.firebaseDatabase.ref('reviews').push(reviewData);
            showToast('Review posted!', 'success');
        }

        textInput.value = '';
        const star5 = document.querySelector('input[name="rating"][value="5"]');
        if (star5) star5.checked = true;

    } catch (error) {
        showToast('Failed to save review', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Post Review';
    }
}

// ========================================
// EDIT REVIEW
// ========================================
function editReview(reviewId) {
    const review = reviewsCache.find(r => r.id === reviewId);
    if (!review || !currentUser || review.userId !== currentUser.uid) {
        showToast('You can only edit your own reviews', 'error');
        return;
    }

    editingReviewId = reviewId;

    const textInput = document.getElementById('reviewText');
    const submitBtn = document.getElementById('submitReviewBtn');

    if (textInput) textInput.value = review.text;

    const ratingInput = document.querySelector(`input[name="rating"][value="${review.rating}"]`);
    if (ratingInput) ratingInput.checked = true;

    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Review';

    let cancelBtn = document.getElementById('cancelEditBtn');
    if (!cancelBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelEditBtn';
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.style.cssText = 'width: 100%; margin-top: 0.5rem;';
        cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
        cancelBtn.onclick = cancelEdit;
        submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
    }
    cancelBtn.style.display = 'block';

    document.getElementById('reviewFormSection').scrollIntoView({ behavior: 'smooth' });
    textInput.focus();
}

function cancelEdit() {
    editingReviewId = null;

    const textInput = document.getElementById('reviewText');
    const submitBtn = document.getElementById('submitReviewBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');

    if (textInput) textInput.value = '';
    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Post Review';
    if (cancelBtn) cancelBtn.style.display = 'none';

    const star5 = document.querySelector('input[name="rating"][value="5"]');
    if (star5) star5.checked = true;
}

// ========================================
// DELETE REVIEW
// ========================================
async function deleteReview(reviewId) {
    const review = reviewsCache.find(r => r.id === reviewId);
    if (!review) return;

    const canDelete = isOwnerUser;

    if (!canDelete) {
        showToast('You cannot delete this review', 'error');
        return;
    }

    if (!confirm('Delete this review?')) return;

    try {
        await window.firebaseDatabase.ref('reviews/' + reviewId).remove();
        showToast('Review deleted', 'success');
        if (editingReviewId === reviewId) cancelEdit();
    } catch (error) {
        showToast('Failed to delete', 'error');
    }
}

// ========================================
// FORMAT DATE - FIXED
// ========================================
function formatDate(timestamp) {
    if (!timestamp) return 'Just now';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.editReview = editReview;
window.deleteReview = deleteReview;
window.cancelEdit = cancelEdit;
