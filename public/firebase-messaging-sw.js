importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
    apiKey: "AIzaSyB8InWRrVM7Uv49EYngnAVaMuHSUmkVrbA",
    authDomain: "hackpton25.firebaseapp.com",
    projectId: "hackpton25",
    storageBucket: "hackpton25.firebasestorage.app",
    messagingSenderId: "209594220719",
    appId: "1:209594220719:web:caeade2bfa71e480c7945a",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/notification-icon.png",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
