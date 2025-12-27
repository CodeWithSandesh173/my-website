// DOM Elements
const authBtn = document.getElementById('auth-btn');
const productGrid = document.getElementById('product-grid');
const chatBubble = document.getElementById('chat-bubble');
const chatWindow = document.getElementById('chat-window');
const closeChat = document.getElementById('close-chat');
const adminLink = document.getElementById('admin-link');
const instagramLink = document.getElementById('instagram-link');

// Set Instagram Link
if (instagramLink) {
    instagramLink.href = 'https://instagram.com/devstorenepal';
    instagramLink.target = '_blank';
}

// Auth State Change
auth.onAuthStateChanged(user => {
    if (user) {
        authBtn.textContent = 'Logout';
        if (user.email === ADMIN_EMAIL) {
            adminLink.style.display = 'block';
        }
        initChat(user);
    } else {
        authBtn.textContent = 'Login with Google';
        adminLink.style.display = 'none';
        const msgs = document.getElementById('chat-messages');
        if (msgs) msgs.innerHTML = '<p style="text-align:center; padding: 20px; opacity: 0.5;">Please login to chat</p>';
    }
});

authBtn.onclick = () => {
    if (auth.currentUser) {
        auth.signOut().then(() => {
            window.location.reload();
        });
    } else {
        auth.signInWithPopup(provider)
            .then((result) => {
                console.log("Logged in:", result.user.email);
                requestNotificationPermission(result.user.uid);
            })
            .catch(error => {
                console.error("Login Error:", error);
                alert("Login failed: " + error.message + "\n\n1. Enable Google Auth in Firebase Console.\n2. Add this domain to Authorized Domains.");
            });
    }
};

// Chat Toggle
chatBubble.onclick = () => {
    chatWindow.style.display = chatWindow.style.display === 'none' ? 'flex' : 'none';
};

closeChat.onclick = () => {
    chatWindow.style.display = 'none';
};

// Products Data
const productsData = [
    { name: "Pubg (uc)", image: "images/pubg.png", prices: ["60uc=170", "120uc=325", "180uc=490", "325uc=800", "385uc=935", "660uc=1495", "720uc=1665", "985uc=2235", "1800uc=3730"] },
    { name: "Free Fire (Diamonds)", image: "images/freefire.png", prices: ["115 diamonds=160", "240 diamonds=235", "610 diamonds=620", "1240 diamonds=1140"] },
    { name: "Steam Giftcard", image: "images/steam.png", prices: ["2$=525", "5$=895", "10$=1730", "15$=2595", "20$=3395"] },
    { name: "iTunes Giftcard", image: "images/itunes.png", prices: ["5$=805", "10$=1610", "20$=3250"] },
    { name: "Spotify", image: "images/spotify.png", prices: ["12 months=3150"] },
    { name: "Discord Nitro", image: "images/discord.png", prices: ["Basic 1 Month=580", "Basic 12 months=5225", "Nitro 1 month=1600", "Nitro 1 year=15500"] },
    { name: "Netflix", image: "images/netflix.png", prices: ["1 month 1 screen=670", "1 month 2 screen=1320", "1month 3 screen=2000"] },
    { name: "GTA V", image: "images/gta.png", prices: ["Standard Edition=2505", "Premium Edition=2605"] },
    { name: "Minecraft", image: "images/minecraft.png", prices: ["Java+Bedrock Edition=4000"] },
    { name: "God of War", image: "images/godofwar.png", prices: ["Steam Version=6000"] }
];

function renderProducts() {
    if (!productGrid) return;
    productGrid.innerHTML = '';
    productsData.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card fade-in';
        card.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="product-image">
            <h3>${product.name}</h3>
            <div class="price-list">
                ${product.prices.map(price => {
            const [label, val] = price.split('=');
            return `<div class="price-item"><span>${label}</span><strong>Rs.${val}</strong></div>`;
        }).join('')}
            </div>
            <button class="btn primary-btn buy-btn" onclick="openOrderModal('${product.name}')">Buy Now</button>
        `;
        productGrid.appendChild(card);
    });
}

// Payment Modal Logic
const paymentModal = document.getElementById('payment-modal');
const closeModalBtn = document.querySelector('.close-modal');
const paymentForm = document.getElementById('payment-form');

window.openOrderModal = (productName) => {
    if (!auth.currentUser) {
        alert('Please login with Google to place an order.');
        return;
    }
    const product = productsData.find(p => p.name === productName);
    const select = document.getElementById('package-selection');
    select.innerHTML = '<option value="" disabled selected>Select your package</option>';

    product.prices.forEach(price => {
        const option = document.createElement('option');
        option.value = price;
        option.textContent = price;
        select.appendChild(option);
    });

    document.getElementById('selected-product').value = productName;
    paymentModal.style.display = 'flex';
};

closeModalBtn.onclick = () => {
    paymentModal.style.display = 'none';
};

window.onclick = (event) => {
    if (event.target == paymentModal) {
        paymentModal.style.display = 'none';
    }
};

paymentForm.onsubmit = (e) => {
    e.preventDefault();
    const productName = document.getElementById('selected-product').value;
    const packageInfo = document.getElementById('package-selection').value;
    const amountPaid = document.getElementById('amount-paid').value;
    const gameId = document.getElementById('game-id').value;
    const bankName = document.getElementById('bank-name').value;
    const transactionId = document.getElementById('transaction-id').value;
    const screenshot = document.getElementById('payment-screenshot').value;

    const orderId = db.ref('orders').push().key;
    db.ref('orders/' + orderId).set({
        product: productName,
        package: packageInfo,
        amount: amountPaid,
        details: `ID: ${gameId} | Bank: ${bankName} | Trans: ${transactionId} | SS: ${screenshot}`,
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        userName: auth.currentUser.displayName || 'User',
        status: 'Pending',
        timestamp: Date.now()
    }).then(() => {
        alert('Order placed successfully! We will process it shortly.');
        paymentModal.style.display = 'none';
        paymentForm.reset();
    }).catch(err => {
        alert('Error placing order. Please check your connection.');
        console.error(err);
    });
};

// Chat Logic
function initChat(user) {
    const chatMsgs = document.getElementById('chat-messages');
    if (!chatMsgs) return;
    const chatId = user.uid;

    db.ref('chats/' + chatId).on('value', snapshot => {
        chatMsgs.innerHTML = '';
        snapshot.forEach(child => {
            const msg = child.val();
            const msgDiv = document.createElement('div');
            msgDiv.className = `message ${msg.sender === 'admin' ? 'admin' : 'user'}`;
            msgDiv.innerHTML = `<p>${msg.text}</p><small>${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>`;
            chatMsgs.appendChild(msgDiv);
        });
        chatMsgs.scrollTop = chatMsgs.scrollHeight;
    });
}

const sendChatBtn = document.getElementById('send-btn');
const chatInput = document.getElementById('chat-input');

if (sendChatBtn) sendChatBtn.onclick = sendMessage;
if (chatInput) chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text && auth.currentUser) {
        const chatId = auth.currentUser.uid;
        db.ref('chats/' + chatId).push({
            text: text,
            sender: auth.currentUser.email === ADMIN_EMAIL ? 'admin' : 'user',
            timestamp: Date.now()
        });
        input.value = '';
    }
}

// Notification Setup
function requestNotificationPermission(userId) {
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            messaging.getToken({ vapidKey: VAPID_KEY }).then(token => {
                if (token) {
                    db.ref('users/' + userId).update({ fcmToken: token });
                }
            });
        }
    });
}

// Background listener (must be in SW, but we can handle foreground here)
messaging.onMessage((payload) => {
    console.log('Message received: ', payload);
    alert('New Notification: ' + payload.notification.title + '\n' + payload.notification.body);
});

// Broadcast Notifications Listener
function listenForNotifications() {
    // We only want to show notifications that were sent AFTER the user loaded the page
    const startTime = Date.now();
    db.ref('notifications').limitToLast(1).on('child_added', snapshot => {
        const notif = snapshot.val();
        if (notif.timestamp > startTime) {
            showNotification(notif.title, notif.message);
        }
    });
}

function showNotification(title, message) {
    // 1. Try Browser Notification
    if ('Notification' in window && Notification.permission === 'granted') {
        const n = new Notification(title, { body: message, icon: 'images/favicon.png' });
        n.onclick = () => {
            window.focus();
            n.close();
        };
    }

    // 2. Always show in-app alert/toast
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: var(--gradient-1);
        color: white;
        padding: 1.5rem;
        border-radius: 20px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        z-index: 10000;
        max-width: 320px;
        animation: slideUp 0.5s ease-out;
        cursor: pointer;
        transition: transform 0.2s;
    `;

    toast.onmouseover = () => toast.style.transform = 'scale(1.02)';
    toast.onmouseout = () => toast.style.transform = 'scale(1)';
    toast.onclick = () => toast.remove();

    toast.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="flex-grow:1;">
                <h4 style="margin:0 0 0.5rem 0; font-size: 1.1rem;">${title}</h4>
                <p style="margin:0; font-size: 0.9rem; opacity: 0.9; line-height: 1.4;">${message}</p>
            </div>
            <i class="fas fa-times" style="opacity: 0.5; margin-left: 1rem; margin-top: 0.2rem;"></i>
        </div>
        <p style="margin-top: 0.8rem; font-size: 0.7rem; opacity: 0.5; text-align: right;">Tap to dismiss</p>
    `;
    document.body.appendChild(toast);

    // Auto remove after 10 seconds
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 10000);
}

// Add animation to CSS if not present
if (!document.getElementById('notif-style')) {
    const style = document.createElement('style');
    style.id = 'notif-style';
    style.innerHTML = `
        @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

listenForNotifications();
renderProducts();
