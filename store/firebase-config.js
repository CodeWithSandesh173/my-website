// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCqr_EYuOP_CNkh84Wbqg5NkvNVuAB6nnU",
    authDomain: "dev-sandesh-uc.firebaseapp.com",
    databaseURL: "https://dev-sandesh-uc-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "dev-sandesh-uc",
    storageBucket: "dev-sandesh-uc.firebasestorage.app",
    messagingSenderId: "438328231734",
    appId: "1:438328231734:web:75962e83c4ca8361825597",
    measurementId: "G-XDVPGH16J3"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.database();
const provider = new firebase.auth.GoogleAuthProvider();
let messaging;
try {
    messaging = firebase.messaging();
} catch (e) {
    console.warn("Firebase Messaging not initialized. Push notifications will be disabled.");
}

const ADMIN_EMAIL = 'bhandaryshandesh2@gmail.com';
const VAPID_KEY = 'BE23jxNO4jeQpfUCv6z4qRfCQc0xstyVdWwKR_isPuJhQXiyK5FbGZ-70eEQ9Z2xqqvtJv3yCX04DrZ-ZzUJk';
