// PWA Service Worker Registration
// Handles service worker lifecycle and updates

export class PWAService {
  private registration: ServiceWorkerRegistration | null = null;
  private updateAvailable = false;

  // Register service worker
  async register(): Promise<void> {
    // SERVICE WORKER COMPLETELY DISABLED - Causing infinite reload
    console.log('[PWA] Service Worker registration DISABLED to fix cache issues');
    
    // Unregister any existing service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        console.log('[PWA] Unregistering existing service worker:', registration.scope);
        await registration.unregister();
      }
    }
    return;
    
    /* DISABLED CODE TO PREVENT SERVICE WORKER ISSUES
    if (!('serviceWorker' in navigator)) {
      console.log('[PWA] Service Workers not supported');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });

      console.log('[PWA] Service Worker registered:', this.registration);

      // Check for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;
        console.log('[PWA] Update found, installing new worker...');

        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            console.log('[PWA] New version available');
            this.updateAvailable = true;
            this.notifyUpdateAvailable();
          }
        });
      });

      // Listen for controller change (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] Controller changed, reloading page...');
        window.location.reload();
      });

      // Check for updates on visibility change
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.registration) {
          this.registration.update();
        }
      });

      // Register background sync
      await this.registerBackgroundSync();

      // Listen for messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleSWMessage(event);
      });

    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
    }
  }

  // Register background sync for offline check-ins
  async registerBackgroundSync(): Promise<void> {
    if (!this.registration) return;

    try {
      // @ts-ignore - Background Sync API not in TS yet
      if ('sync' in this.registration) {
        // @ts-ignore
        await this.registration.sync.register('sync-checkins');
        console.log('[PWA] Background sync registered');
      }
    } catch (error) {
      console.error('[PWA] Background sync registration failed:', error);
    }
  }

  // Skip waiting and activate new service worker
  async skipWaiting(): Promise<void> {
    if (!this.registration?.waiting) return;

    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  // Handle messages from service worker
  private handleSWMessage(event: MessageEvent): void {
    const { type, data } = event.data;

    switch (type) {
      case 'SYNC_COMPLETE':
        console.log('[PWA] Sync complete:', data);
        this.notifySyncComplete(data.count);
        break;
      
      case 'CACHE_UPDATED':
        console.log('[PWA] Cache updated');
        break;
      
      default:
        console.log('[PWA] Unknown message:', type, data);
    }
  }

  // Notify user that update is available
  private notifyUpdateAvailable(): void {
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('pwa-update-available'));
    
    // Show notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Update Available', {
        body: 'A new version of OpenTicket Scanner is available. Tap to update.',
        icon: '/icons/icon-192.svg',
        tag: 'update-available'
      });
    }
  }

  // Notify that sync is complete
  private notifySyncComplete(count: number): void {
    window.dispatchEvent(new CustomEvent('pwa-sync-complete', {
      detail: { count }
    }));
  }

  // Check if app is installed as PWA
  isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }

  // Request notification permission
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      return await Notification.requestPermission();
    }

    return Notification.permission;
  }

  // Show install prompt
  showInstallPrompt(): void {
    // This will be handled by the beforeinstallprompt event
    window.dispatchEvent(new Event('show-install-prompt'));
  }

  // Get update status
  isUpdateAvailable(): boolean {
    return this.updateAvailable;
  }

  // Unregister service worker (for debugging)
  async unregister(): Promise<void> {
    if (!this.registration) return;

    try {
      await this.registration.unregister();
      console.log('[PWA] Service Worker unregistered');
    } catch (error) {
      console.error('[PWA] Unregister failed:', error);
    }
  }
}

// Export singleton instance
export const pwaService = new PWAService();
export default pwaService;
