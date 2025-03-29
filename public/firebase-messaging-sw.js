importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js"
);

// You need to replace these values with your actual Firebase config values
const firebaseConfig = {
  apiKey: "AIzaSyDpxPp1xWwCPtHlm0dO7Mk8iUb8M7UaAL8",
  authDomain: "hackprinceton25-4e41d.firebaseapp.com",
  projectId: "hackprinceton25-4e41d",
  storageBucket: "hackprinceton25-4e41d.firebasestorage.app",
  messagingSenderId: "767556643208",
  appId: "1:767556643208:web:233d40312a05d8c2c3b23d",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/eyeLogo.png",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("push", function (event) {
  console.log("Push message received:", event);
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log("Push notification payload:", payload);

      const options = {
        body: payload.notification.body,
        icon: "/eyeLogo.png",
        badge: "/eyeLogo.png",
        data: payload.data, // Include any additional data
      };

      event.waitUntil(
        self.registration.showNotification(payload.notification.title, options)
      );
    } catch (error) {
      console.error("Error processing push notification:", error);
    }
  }
});

// Add this to handle notification clicks
self.addEventListener("notificationclick", function (event) {
  console.log("Notification click received:", event);
  event.notification.close();
  // Add custom click handling here if needed
});
