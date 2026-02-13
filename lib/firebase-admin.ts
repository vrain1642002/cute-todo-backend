import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
            ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
            : undefined;

        if (serviceAccount) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        } else {
            console.warn('FIREBASE_SERVICE_ACCOUNT_KEY not found. Notifications will fail.');
            // Fallback for local dev without creds if needed, or just let it fail.
            // admin.initializeApp(); // Only works if GOOGLE_APPLICATION_CREDENTIALS is set
        }
    } catch (error) {
        console.error('Firebase admin initialization error', error);
    }
}

export const messaging = admin.messaging();
