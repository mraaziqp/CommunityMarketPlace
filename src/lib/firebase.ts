import { initializeApp, getApps, getApp } from 'firebase/app';

/**
 * Firebase Client Configuration for ShareHub
 * Used for client-side Firebase services, Storage references, and media assets.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyAHX478zH88ZhhXvQrmOu6RcRUWAoeDt6U',
  authDomain: 'studio-5687996797-777f2.firebaseapp.com',
  projectId: 'studio-5687996797-777f2',
  storageBucket: 'studio-5687996797-777f2.firebasestorage.app',
  messagingSenderId: '850485784910',
  appId: '1:850485784910:web:5e0fc1f2b1e8d899b76e1f',
};

// Initialize or reuse Firebase App
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
