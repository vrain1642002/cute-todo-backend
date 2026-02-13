import { NextResponse } from 'next/server';
import { getMessaging, getFirestore } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    console.log('Cron Job Started: Checking deadlines');
    try {
        const db = getFirestore();
        const messaging = getMessaging();
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

        // 🚀 ULTRA-SAFE QUERY: Only query by status
        const todosSnapshot = await db.collection('todos')
            .where('status', '==', 'todo')
            .get();

        console.log(`Scanning window: ${fiveMinutesAgo.toISOString()} to ${tenMinutesFromNow.toISOString()}`);

        if (todosSnapshot.empty) {
            return NextResponse.json({ success: true, message: 'No tasks with status "todo" found.' });
        }

        const results = [];

        for (const doc of todosSnapshot.docs) {
            const todo = doc.data();
            const todoId = doc.id;

            // 1. Skip if already notified
            if (todo.notificationSent === true) continue;

            // 2. Process deadline dates (handle various Firestore date formats safely)
            const rawDueDate = todo.dueDate;
            if (!rawDueDate) continue;

            const dueDate = (rawDueDate.toDate && typeof rawDueDate.toDate === 'function')
                ? rawDueDate.toDate()
                : new Date(rawDueDate);

            // 3. In-memory check: Is it due between 5 mins ago and 10 mins from now?
            const isDueSoon = dueDate >= fiveMinutesAgo && dueDate <= tenMinutesFromNow;

            if (!isDueSoon) continue;

            const userId = todo.userId;
            console.log(`Processing soon-to-be-due todo: "${todo.title}" for user: ${userId}`);

            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.exists ? userDoc.data() : null;

            if (!userData) {
                console.warn(`User document not found for ID: ${userId}`);
                continue;
            }

            const fcmToken = userData.fcmToken;
            const email = userData.email;
            const userName = userData.displayName || 'User';

            const sentMethods = [];
            const errors = [];

            // Send FCM
            if (fcmToken) {
                try {
                    await messaging.send({
                        token: fcmToken,
                        notification: {
                            title: '⏰ Deadline sắp đến!',
                            body: `Công việc "${todo.title}" sắp đến hạn chót!`,
                        },
                        android: { priority: 'high' },
                        apns: { payload: { aps: { contentAvailable: true } } },
                    });
                    sentMethods.push('FCM');
                } catch (e: any) {
                    const msg = `FCM failed: ${e.message}`;
                    console.error(msg);
                    errors.push(msg);
                }
            } else {
                errors.push('No FCM Token found for user');
            }

            // Send Email via EmailJS
            if (email) {
                try {
                    const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_lx2vsyo';
                    const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || 'template_x7tbqfs';
                    const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'VrD4W6V_afAXyBvag';
                    const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY; // NEW: Access Token

                    const dueTime = dueDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

                    interface EmailPayload {
                        service_id: string;
                        template_id: string;
                        user_id: string;
                        template_params: Record<string, string>;
                        accessToken?: string;
                    }

                    const emailPayload: EmailPayload = {
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
                    };

                    // Add Access Token if available (Required for Server-side/Strict Mode)
                    if (EMAILJS_PRIVATE_KEY) {
                        emailPayload.accessToken = EMAILJS_PRIVATE_KEY;
                    }

                    const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(emailPayload),
                    });

                    if (emailResponse.ok) {
                        sentMethods.push('Email');
                    } else {
                        const err = await emailResponse.text();
                        console.error(`EmailJS failed: ${err}`);
                        errors.push(`EmailJS Error: ${err}`);
                    }
                } catch (e: any) {
                    console.error(`Email attempt failed for todo ${todoId}:`, e.message);
                    errors.push(`Email Exception: ${e.message}`);
                }
            } else {
                errors.push('No Email found for user');
            }

            // Mark as sent
            await doc.ref.update({ notificationSent: true });
            results.push({
                todoId,
                title: todo.title,
                sentTo: email,
                methods: sentMethods,
                errors: errors // Return errors to client
            });
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
            message: error.message
        }, { status: 500 });
    }
}
