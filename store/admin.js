let activeChatUserId = null;
let currentView = 'orders';

// Auth Guard Logic with Timeout
const authTimeout = setTimeout(() => {
    const loader = document.getElementById('admin-auth-overlay');
    const overlayError = document.getElementById('overlay-error');
    if (loader && loader.style.display !== 'none') {
        loader.querySelector('.loader').style.display = 'none';
        if (overlayError) {
            overlayError.style.display = 'block';
            document.getElementById('error-msg').textContent = "Verification timed out. Check your connection or try logging in again.";
        }
    }
}, 8000); // 8 second timeout

auth.onAuthStateChanged(user => {
    clearTimeout(authTimeout);
    console.log("Admin Check - Current User:", user ? user.email : "Not Logged In");

    const overlay = document.getElementById('admin-auth-overlay');
    const root = document.getElementById('admin-dashboard-root');
    const overlayError = document.getElementById('overlay-error');
    const errorMsg = document.getElementById('error-msg');
    const emailDisplay = document.getElementById('admin-email-display');

    if (overlay) overlay.querySelector('.loader').style.display = 'none';

    if (user) {
        if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            console.log("Access Granted: Admin detected.");
            if (overlay) overlay.style.display = 'none';
            if (root) root.style.display = 'flex';
            if (emailDisplay) emailDisplay.textContent = user.email;
            initAdmin();
        } else {
            console.warn("Access Denied: Logged in as", user.email);
            if (overlay) overlay.style.display = 'flex';
            if (overlayError) overlayError.style.display = 'block';
            if (errorMsg) errorMsg.textContent = `Access Restricted. Logged in as: ${user.email}`;
        }
    } else {
        console.log("No user found. Showing login prompt.");
        if (overlay) overlay.style.display = 'flex';
        if (overlayError) overlayError.style.display = 'block';
        if (errorMsg) errorMsg.textContent = "Please sign in with the Administrator account.";
    }
});

function initAdmin() {
    loadStats();
    loadOrders();
    loadChatList();
    setupNavigation();
}

// Navigation Logic
function setupNavigation() {
    const navOrders = document.getElementById('nav-orders');
    const navChats = document.getElementById('nav-chats');
    const navNotifications = document.getElementById('nav-notifications');
    const ordersView = document.getElementById('orders-view');
    const chatsView = document.getElementById('chats-view');
    const notificationsView = document.getElementById('notifications-view');
    const viewTitle = document.getElementById('view-title');

    navOrders.onclick = (e) => {
        e.preventDefault();
        currentView = 'orders';
        navOrders.classList.add('active');
        navChats.classList.remove('active');
        ordersView.style.display = 'block';
        chatsView.style.display = 'none';
        viewTitle.textContent = "Orders Dashboard";
    };

    navChats.onclick = (e) => {
        e.preventDefault();
        currentView = 'chats';
        navChats.classList.add('active');
        navOrders.classList.remove('active');
        chatsView.style.display = 'block';
        ordersView.style.display = 'none';
        viewTitle.textContent = "Support Chats";
    };
}

// Stats Logic
function loadStats() {
    db.ref('orders').on('value', snapshot => {
        const orders = snapshot.val() || {};
        const orderList = Object.values(orders);
        document.getElementById('stat-total-orders').textContent = orderList.length;
        document.getElementById('stat-pending-orders').textContent = orderList.filter(o => o.status === 'Pending').length;
    });
}

// Load Orders
function loadOrders() {
    const list = document.getElementById('orders-list');
    db.ref('orders').on('value', snapshot => {
        list.innerHTML = '';
        const orders = [];
        snapshot.forEach(child => {
            orders.push({ id: child.key, ...child.val() });
        });

        orders.reverse().forEach(order => {
            const card = document.createElement('div');
            card.className = 'product-card admin-order-card';
            card.style.transition = 'var(--transition)';
            card.onmouseover = () => card.style.transform = 'translateY(-5px) scale(1.02)';
            card.onmouseout = () => card.style.transform = 'translateY(0) scale(1)';
            card.innerHTML = `
                <div class="order-header">
                    <h3 style="margin:0">${order.product}</h3>
                    <span class="status-badge status-${(order.status || 'Pending').toLowerCase()}">${order.status || 'Pending'}</span>
                </div>
                <div style="margin: 1rem 0; font-size: 0.9rem;">
                    <p><strong>Package:</strong> ${order.package || 'Standard'}</p>
                    <p><strong>Paid:</strong> Rs. ${order.amount || 'N/A'}</p>
                    <p><strong>User:</strong> ${order.userName}</p>
                    <p style="opacity:0.7; font-size: 0.8rem; margin-top:0.5rem;">${order.details}</p>
                    <p style="font-size: 0.7rem; opacity:0.5; margin-top:0.5rem;">${new Date(order.timestamp).toLocaleString()}</p>
                </div>
                <div style="margin-top: auto; display: grid; gap: 0.5rem;">
                    <button class="btn primary-btn" onclick="updateOrderStatus('${order.id}', 'Completed')" style="padding: 0.5rem; font-size: 0.8rem;">Complete</button>
                    <button class="btn secondary-btn" onclick="deleteOrder('${order.id}')" style="padding: 0.5rem; font-size: 0.8rem; color: #ff4444;">Delete</button>
                </div>
            `;
            list.appendChild(card);
        });
    });
}

window.updateOrderStatus = (orderId, status) => {
    db.ref('orders/' + orderId).update({ status: status }).then(() => {
        if (status === 'Completed') {
            // Fetch order details to make notification personalized
            db.ref('orders/' + orderId).once('value', snapshot => {
                const order = snapshot.val();
                if (order) {
                    const title = "Order Completed! ✅";
                    const message = `Order for ${order.product} (${order.package}) has been processed successfully. Thank you for choosing us!`;

                    // Push to notifications node to trigger broadcast
                    const notifId = db.ref('notifications').push().key;
                    db.ref('notifications/' + notifId).set({
                        title: title,
                        message: message,
                        timestamp: Date.now(),
                        type: 'order_update',
                        userId: order.userId // Optional: could be used for targeted notifications later
                    });
                }
            });
        }
    });
};

window.deleteOrder = (orderId) => {
    if (confirm('Delete this order permanently?')) {
        db.ref('orders/' + orderId).remove();
    }
};

// Load Chat List
function loadChatList() {
    const list = document.getElementById('chat-list');
    db.ref('chats').on('value', snapshot => {
        list.innerHTML = '';
        snapshot.forEach(child => {
            const userId = child.key;
            const msgs = Object.values(child.val());
            const lastMsg = msgs[msgs.length - 1];

            const item = document.createElement('div');
            item.className = `chat-item ${activeChatUserId === userId ? 'active' : ''}`;
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color: white; font-size: 1rem;">User ${userId.substring(0, 5)}</strong>
                    <small style="opacity:0.4;">${new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                </div>
                <p style="font-size: 0.85rem; opacity:0.6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top:0.4rem;">
                    ${lastMsg.text}
                </p>
            `;
            item.onclick = () => openAdminChat(userId);
            list.appendChild(item);
        });
    });
}

function openAdminChat(userId) {
    activeChatUserId = userId;
    document.getElementById('active-chat-container').style.display = 'flex';
    document.getElementById('no-chat-selected').style.display = 'none';
    document.getElementById('active-chat-user').textContent = 'Chatting with User ' + userId.substring(0, 8);

    const messagesDiv = document.getElementById('admin-chat-messages');
    db.ref('chats/' + userId).off();
    db.ref('chats/' + userId).on('value', snapshot => {
        messagesDiv.innerHTML = '';
        snapshot.forEach(child => {
            const msg = child.val();
            const div = document.createElement('div');
            div.className = `message ${msg.sender === 'admin' ? 'admin' : 'user'}`;
            div.innerHTML = `<p>${msg.text}</p><small>${new Date(msg.timestamp).toLocaleTimeString()}</small>`;
            messagesDiv.appendChild(div);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}

document.getElementById('admin-send-btn').onclick = sendAdminReply;
document.getElementById('admin-chat-input').onkeypress = (e) => { if (e.key === 'Enter') sendAdminReply(); };

function sendAdminReply() {
    const input = document.getElementById('admin-chat-input');
    const text = input.value ? input.value.trim() : "";
    if (text && activeChatUserId) {
        db.ref('chats/' + activeChatUserId).push({
            text: text,
            sender: 'admin',
            timestamp: Date.now()
        });
        input.value = '';
    }
}

// Notifications Logic
window.sendBroadcastNotification = () => {
    const title = document.getElementById('notif-title').value.trim();
    const message = document.getElementById('notif-message').value.trim();

    if (!title || !message) {
        alert('Please fill in both title and message.');
        return;
    }

    const notifId = db.ref('notifications').push().key;
    db.ref('notifications/' + notifId).set({
        title: title,
        message: message,
        timestamp: Date.now()
    }).then(() => {
        alert('Notification broadcasted successfully!');
        document.getElementById('notif-title').value = '';
        document.getElementById('notif-message').value = '';
    }).catch(err => {
        console.error("Error sending notification:", err);
        alert('Failed to send notification.');
    });
};

function loadNotificationHistory() {
    const list = document.getElementById('notif-history');
    db.ref('notifications').off();
    db.ref('notifications').on('value', snapshot => {
        list.innerHTML = '';
        const notifs = [];
        snapshot.forEach(child => {
            notifs.push(child.val());
        });

        notifs.reverse().forEach(notif => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.style.padding = '1.5rem';
            card.innerHTML = `
                <h4 style="margin:0; color: white;">${notif.title}</h4>
                <p style="font-size: 0.9rem; opacity:0.7; margin: 0.5rem 0;">${notif.message}</p>
                <small style="opacity:0.4;">${new Date(notif.timestamp).toLocaleString()}</small>
            `;
            list.appendChild(card);
        });
    });
}

document.getElementById('logout-btn').onclick = () => {
    auth.signOut().then(() => window.location.href = 'index.html');
};
