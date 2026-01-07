// ========================================
// FIREBASE CONFIGURATION
// ========================================

const firebaseConfig = {
    apiKey: "AIzaSyBNLoJfgjGYPgWYPgSii5CnVscl7Al5vIo",
    authDomain: "website-bd28f.firebaseapp.com",
    databaseURL: "https://website-bd28f-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "website-bd28f",
    storageBucket: "website-bd28f.firebasestorage.app",
    messagingSenderId: "955197303266",
    appId: "1:955197303266:web:9eafdc52ffa9f1727831bb",
    measurementId: "G-4PGYCRWKLJ"
};

// Owner username (not email - more secure)
const OWNER_USERNAME = 'sandesh';

// Initialize Firebase
let database = null;
let auth = null;

try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        database = firebase.database();
        auth = firebase.auth();
        console.log('Firebase initialized');
    }
} catch (error) {
    console.error('Firebase error:', error.message);
}

// Check if user is owner by username
async function isOwner(user) {
    if (!user) return false;

    try {
        const snapshot = await database.ref('users/' + user.uid + '/username').once('value');
        const username = snapshot.val();
        return username === OWNER_USERNAME;
    } catch (error) {
        console.error('Owner check error:', error);
        return false;
    }
}

// Check if username exists
async function isUsernameTaken(username) {
    try {
        const snapshot = await database.ref('usernames/' + username.toLowerCase()).once('value');
        return snapshot.exists();
    } catch (error) {
        console.error('Username check error:', error);
        return false;
    }
}

// Get username by user ID
async function getUsername(userId) {
    try {
        const snapshot = await database.ref('users/' + userId + '/username').once('value');
        return snapshot.val() || 'User';
    } catch (error) {
        return 'User';
    }
}

// Export
window.firebaseDatabase = database;
window.firebaseAuth = auth;
window.isOwner = isOwner;
window.isUsernameTaken = isUsernameTaken;
window.getUsername = getUsername;
window.OWNER_USERNAME = OWNER_USERNAME;
