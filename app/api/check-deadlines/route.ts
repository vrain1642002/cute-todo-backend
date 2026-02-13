import { NextResponse } from 'next/server';
import { getMessaging, getFirestore } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    console.log('Cron Job Started: Checking deadlines');
    try {
        const db = getFirestore();
        const messaging = getMessaging();
        const now = new Date();
        const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

        // Simplify query to avoid complex index requirements which often cause 500 errors
        // We'll filter 'notificationSent' in memory if needed, or keep it simple
        const todosSnapshot = await db.collection('todos')
            .where('status', '==', 'todo')
            .where('dueDate', '>=', now)
            .where('dueDate', '<=', tenMinutesFromNow)
            .get();

        console.log(`Query returned ${todosSnapshot.size} potential todos`);

        if (todosSnapshot.empty) {
            return NextResponse.json({ success: true, message: 'No upcoming deadlines found.' });
        }

        const results = [];

        for (const doc of todosSnapshot.docs) {
            const todo = doc.data();
            const todoId = doc.id;

            // Filter notificationSent in-memory to avoid needing a complex Firestore Index
            if (todo.notificationSent === true) continue;

            const userId = todo.userId;
            console.log(`Processing todo: ${todo.title} for user: ${userId}`);

            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.exists ? userDoc.data() : null;

            if (!userData) {
                console.warn(`User document not found for ID: ${userId}`);
                continue;
            }

            const fcmToken = userData.fcmToken;
            const email = userData.email;
            const userName = userData.displayName || 'User';

            // Send FCM
            if (fcmToken) {
                try {
                    await messaging.send({
                        token: fcmToken,
                        notification: {
                            title: '⏰ Deadline sắp đến!',
                            body: `Công việc "${todo.title}" sắp đến hạn chót.`,
                        },
                        android: { priority: 'high' },
                        apns: { payload: { aps: { contentAvailable: true } } },
                    });
                    console.log(`FCM sent successfully to user ${userId}`);
                } catch (e: any) {
                    console.error(`FCM failed for todo ${todoId}:`, e.message);
                }
            }

            // Send Email via EmailJS
            if (email) {
                try {
                    const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_lx2vsyo';
                    const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || 'template_x7tbqfs';
                    const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'VrD4W6V_afAXyBvag';

                    // Formatting date for email
                    const dateObj = todo.dueDate.toDate ? todo.dueDate.toDate() : new Date(todo.dueDate);
                    const dueTime = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

                    const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
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

                    if (emailResponse.ok) {
                        console.log(`Email sent successfully via EmailJS to ${email}`);
                    } else {
                        const err = await emailResponse.text();
                        console.error(`EmailJS failed: ${emailResponse.status} - ${err}`);
                    }
                } catch (e: any) {
                    console.error(`Email attempt failed for todo ${todoId}:`, e.message);
                }
            }

            // Mark as sent
            await doc.ref.update({ notificationSent: true });
            results.push({ todoId, title: todo.title });
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            results
        });
    } catch (error: any) {
        console.error('CRITICAL CRON ERROR:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
