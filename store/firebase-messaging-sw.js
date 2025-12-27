importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCqr_EYuOP_CNkh84Wbqg5NkvNVuAB6nnU",
    authDomain: "dev-sandesh-uc.firebaseapp.com",
    databaseURL: "https://dev-sandesh-uc-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "dev-sandesh-uc",
    storageBucket: "dev-sandesh-uc.firebasestorage.app",
    messagingSenderId: "438328231734",
    appId: "1:438328231734:web:75962e83c4ca8361825597",
    measurementId: "G-XDVPGH16J3"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/images/favicon.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
