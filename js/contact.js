// ========================================
// CONTACT.JS - Contact Form with Username
// ========================================

let currentUser = null;
let isOwnerUser = false;
let currentUsername = '';

document.addEventListener('DOMContentLoaded', () => {
    initContactPage();
});

function initContactPage() {
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

                handleAuthState(user);

                if (isOwnerUser) {
                    loadOwnerMessages();
                }
            });

            const contactForm = document.getElementById('contactForm');
            if (contactForm) {
                contactForm.addEventListener('submit', handleFormSubmit);
            }
        }
    }, 100);

    setTimeout(() => clearInterval(checkFirebase), 5000);
}

// ========================================
// HANDLE AUTH STATE
// ========================================
function handleAuthState(user) {
    const loginRequired = document.getElementById('loginRequired');
    const contactContent = document.getElementById('contactContent');
    const verificationWarning = document.getElementById('verificationWarning');
    const submitBtn = document.getElementById('submitBtn');
    const loginNavLink = document.getElementById('loginNavLink');
    const userBar = document.getElementById('userBar');
    const ownerInbox = document.getElementById('ownerInbox');

    if (user) {
        if (loginRequired) loginRequired.style.display = 'none';
        if (contactContent) contactContent.style.display = 'block';
        if (userBar) userBar.classList.add('show');

        updateUserDisplay(user);

        if (isOwnerUser && ownerInbox) {
            ownerInbox.style.display = 'block';
        }

        if (!user.emailVerified) {
            if (verificationWarning) verificationWarning.classList.add('show');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
            }
        } else {
            if (verificationWarning) verificationWarning.classList.remove('show');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
            }
        }

        if (loginNavLink) loginNavLink.textContent = 'Account';
    } else {
        if (loginRequired) loginRequired.style.display = 'block';
        if (contactContent) contactContent.style.display = 'none';
        if (userBar) userBar.classList.remove('show');
        if (ownerInbox) ownerInbox.style.display = 'none';
        if (loginNavLink) loginNavLink.textContent = 'Login';
    }
}

function updateUserDisplay(user) {
    const userAvatar = document.getElementById('userAvatar');
    const userDisplayName = document.getElementById('userDisplayName');
    const userEmailDisplay = document.getElementById('userEmailDisplay');

    const name = user.displayName || 'User';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

    if (userAvatar) userAvatar.textContent = initials;
    if (userDisplayName) userDisplayName.textContent = name;
    // Show username instead of email
    if (userEmailDisplay) userEmailDisplay.textContent = '@' + currentUsername;
}

// ========================================
// LOAD OWNER MESSAGES
// ========================================
function loadOwnerMessages() {
    if (!isOwnerUser) return;

    const messagesRef = window.firebaseDatabase.ref('messages');

    messagesRef.orderByChild('timestamp').on('value', (snapshot) => {
        const messages = [];
        snapshot.forEach((child) => {
            messages.push({ id: child.key, ...child.val() });
        });
        messages.reverse();
        renderOwnerMessages(messages);
    });
}

function renderOwnerMessages(messages) {
    const messagesList = document.getElementById('ownerMessagesList');
    const noMessages = document.getElementById('noMessages');
    const messageCount = document.getElementById('messageCount');

    if (!messagesList) return;

    messagesList.innerHTML = '';

    if (messageCount) messageCount.textContent = `${messages.length} message${messages.length !== 1 ? 's' : ''}`;

    if (messages.length === 0) {
        if (noMessages) noMessages.style.display = 'block';
        return;
    }

    if (noMessages) noMessages.style.display = 'none';

    messages.forEach(msg => messagesList.appendChild(createMessageCard(msg)));
}

function createMessageCard(msg) {
    const card = document.createElement('div');
    card.className = 'inbox-message';

    const name = msg.name || 'User';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    const date = formatDate(msg.timestamp);

    card.innerHTML = `
    <div class="inbox-header">
      <div class="inbox-sender">
        <div class="inbox-avatar">${initials}</div>
        <div>
          <strong>${escapeHtml(name)}</strong>
          <span class="inbox-email">@${escapeHtml(msg.username || 'user')}</span>
        </div>
      </div>
      <span class="inbox-date">${date}</span>
    </div>
    <div class="inbox-subject">${escapeHtml(msg.subject)}</div>
    <div class="inbox-preview">${escapeHtml(msg.message)}</div>
    <div class="inbox-actions">
      <button onclick="deleteMessage('${msg.id}')" class="inbox-btn delete">
        <i class="fas fa-trash"></i> Delete
      </button>
    </div>
  `;

    return card;
}

async function deleteMessage(messageId) {
    if (!isOwnerUser) {
        showToast('Access denied', 'error');
        return;
    }

    if (!confirm('Delete this message?')) return;

    try {
        await window.firebaseDatabase.ref('messages/' + messageId).remove();
        showToast('Message deleted', 'success');
    } catch (error) {
        showToast('Failed to delete', 'error');
    }
}

// ========================================
// HANDLE FORM SUBMIT
// ========================================
async function handleFormSubmit(e) {
    e.preventDefault();

    if (!window.firebaseAuth || !window.firebaseDatabase) {
        showToast('System not ready. Please refresh.', 'error');
        return;
    }

    const user = window.firebaseAuth.currentUser;

    if (!user || !user.emailVerified) {
        showToast('Please verify your email first', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const contactForm = document.getElementById('contactForm');
    const successMessage = document.getElementById('successMessage');
    const userBar = document.getElementById('userBar');

    const subject = document.getElementById('subject').value.trim();
    const message = document.getElementById('message').value.trim();

    if (!subject || !message) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    // Use display name and username from account (fixed)
    const messageData = {
        name: user.displayName || 'User',
        username: currentUsername,
        subject: subject,
        message: message,
        timestamp: Date.now(),
        userId: user.uid
    };

    submitBtn.disabled = true;
    submitText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        await window.firebaseDatabase.ref('messages').push(messageData);

        if (contactForm) contactForm.style.display = 'none';
        if (userBar) userBar.style.display = 'none';
        if (successMessage) successMessage.classList.add('show');

        showToast('Message sent!', 'success');
    } catch (error) {
        showToast('Failed to send: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitText.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
    }
}

// ========================================
// UTILITIES
// ========================================
function resetForm() {
    const contactForm = document.getElementById('contactForm');
    const successMessage = document.getElementById('successMessage');
    const userBar = document.getElementById('userBar');

    if (contactForm) { contactForm.reset(); contactForm.style.display = 'block'; }
    if (successMessage) successMessage.classList.remove('show');
    if (userBar) userBar.style.display = 'flex';
}

async function resendVerificationEmail() {
    const user = window.firebaseAuth?.currentUser;
    if (user && !user.emailVerified) {
        try {
            await user.sendEmailVerification();
            showToast('Verification email sent!', 'success');
        } catch (error) {
            showToast('Please wait before requesting again', 'error');
        }
    }
}

async function logout() {
    try {
        await window.firebaseAuth.signOut();
        showToast('Logged out', 'success');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.resetForm = resetForm;
window.resendVerificationEmail = resendVerificationEmail;
window.logout = logout;
window.deleteMessage = deleteMessage;
