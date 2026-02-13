import { NextResponse } from 'next/server';
import { getMessaging, getFirestore } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

// Endpoint to be called by a cron job (e.g., cron-job.org)
export async function GET(request: Request) {
    try {
        const db = getFirestore();
        const messaging = getMessaging();
        const now = new Date();
        const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

        console.log(`Checking deadlines between ${now.toISOString()} and ${tenMinutesFromNow.toISOString()}`);

        // Query for tasks that:
        // 1. Are in 'todo' status
        // 2. Have a dueDate within the next 10 minutes
        // 3. Haven't had a notification sent yet
        const todosSnapshot = await db.collection('todos')
            .where('status', '==', 'todo')
            .where('dueDate', '>=', now)
            .where('dueDate', '<=', tenMinutesFromNow)
            .where('notificationSent', '!=', true)
            .get();

        if (todosSnapshot.empty) {
            return NextResponse.json({ message: 'No upcoming deadlines found.' });
        }

        const results = [];

        for (const doc of todosSnapshot.docs) {
            const todo = doc.data();
            const todoId = doc.id;
            const userId = todo.userId;

            // Get user's email and FCM token from 'users' collection
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.exists ? userDoc.data() : null;

            if (!userData) continue;

            const fcmToken = userData.fcmToken;
            const email = userData.email;
            const userName = userData.displayName || 'User';

            // Send FCM
            if (fcmToken) {
                try {
                    await messaging.send({
                        token: fcmToken,
                        notification: {
                            title: '⏰ Deadline approaching!',
                            body: `Task "${todo.title}" is due soon.`,
                        },
                        android: { priority: 'high' },
                        apns: { payload: { aps: { contentAvailable: true } } },
                    });
                } catch (e) {
                    console.error(`FCM failed for todo ${todoId}:`, e);
                }
            }

            // Send Email via EmailJS
            if (email) {
                try {
                    const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_lx2vsyo';
                    const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || 'template_x7tbqfs';
                    const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'VrD4W6V_afAXyBvag';

                    const dueTime = todo.dueDate.toDate().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

                    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            service_id: EMAILJS_SERVICE_ID,
                            template_id: EMAILJS_TEMPLATE_ID,
                            user_id: EMAILJS_PUBLIC_KEY,
                            template_params: {
                                to_email: email,
                                user_name: userName,
                                task_title: todo.title,
                                due_time: dueTime,
                                subject: `⏰ Nhắc nhở Deadline - ${todo.title}`,
                            },
                        }),
                    });
                } catch (e) {
                    console.error(`Email failed for todo ${todoId}:`, e);
                }
            }

            // Mark as sent
            await doc.ref.update({ notificationSent: true });
            results.push({ todoId, title: todo.title, status: 'notified' });
        }

        return NextResponse.json({ success: true, processed: results.length, results });
    } catch (error: any) {
        console.error('Cron Error:', error);
        return NextResponse.json({ error: 'Failed to check deadlines', details: error.message }, { status: 500 });
    }
}
