import * as admin from 'firebase-admin';

/**
 * Initializes Firebase Admin in a way that is safe for Next.js build-time.
 * Build environments (like Vercel) may not have access to secrets,
 * so we only initialize if the credentials are present and we are in a runtime environment.
 */
function getFirebaseAdmin() {
    if (!admin.apps.length) {
        try {
            const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
                ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
                : undefined;

            if (serviceAccount) {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                });
                console.log('Firebase Admin initialized successfully');
            } else {
                // We log a warning but don't throw, so the build can complete.
                // Runtime calls to messaging will fail gracefully later.
                console.warn('FIREBASE_SERVICE_ACCOUNT_KEY missing. Firebase services will be unavailable.');
            }
        } catch (error) {
            console.error('Firebase admin initialization error:', error);
        }
    }
    return admin;
}

// Export a getter for messaging to avoid top-level 'app/no-app' errors during build
export const getMessaging = () => {
    const app = getFirebaseAdmin();
    if (!app.apps.length) {
        throw new Error('Firebase app not initialized. Check your environment variables.');
    }
    return app.messaging();
};

export const getFirestore = () => {
    const app = getFirebaseAdmin();
    if (!app.apps.length) {
        throw new Error('Firebase app not initialized. Check your environment variables.');
    }
    return app.firestore();
};
