import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Generate a build timestamp for cache busting
const BUILD_TIMESTAMP = Date.now();

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    publicDir: 'public',
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '.preview.emergentagent.com',
        '.emergentagent.com'
      ],
      headers: {
        // Prevent caching of HTML in development
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      fs: {
        allow: ['/app', '/app/frontend']
      },
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8001',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // Inject build info for debugging
      '__BUILD_TIMESTAMP__': JSON.stringify(BUILD_TIMESTAMP),
      '__BUILD_DATE__': JSON.stringify(new Date().toISOString())
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      // Ensure modules are resolved from frontend/node_modules
      modules: [
        path.resolve(__dirname, 'frontend/node_modules'),
        path.resolve(__dirname, 'node_modules'),
        'node_modules'
      ]
    },
    optimizeDeps: {
      include: ['socket.io-client']
    },
    build: {
      chunkSizeWarningLimit: 1000,
      // Add hash to filenames for cache busting
      rollupOptions: {
        output: {
          // Ensure unique file names with content hash
          entryFileNames: `assets/[name]-[hash]-${BUILD_TIMESTAMP}.js`,
          chunkFileNames: `assets/[name]-[hash].js`,
          assetFileNames: `assets/[name]-[hash].[ext]`,
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom', '@stripe/stripe-js'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/storage'],
            socketio: ['socket.io-client']
          }
        }
      }
    }
  };
});
