// Explicit service worker registration fallback
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('✅ Service Worker registered:', registration.scope);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('📦 New service worker installing...');

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              console.log('✨ New service worker activated');
            }
          });
        });
      })
      .catch(error => {
        console.error('❌ Service Worker registration failed:', error);
      });

    // Log service worker state changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('🔄 Service Worker controller changed');
    });
  });

  // Log when app is controlled by service worker
  if (navigator.serviceWorker.controller) {
    console.log('✅ Page is controlled by service worker');
  } else {
    console.log('⚠️ Page is NOT controlled by service worker yet');
  }
}
