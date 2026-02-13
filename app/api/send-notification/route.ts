import { NextResponse } from 'next/server';
import { getMessaging } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            token, // FCM Token
            email, // Recipient Email
            title,
            body: messageBody,
            userName,
            taskTitle,
            dueTime,
            minutesLeft,
            languageCode = 'vi'
        } = body;

        const results = {
            fcm: 'skipped',
            email: 'skipped',
        };

        // 1. Send FCM Push Notification
        if (token) {
            try {
                const messaging = getMessaging(); // Initialize on demand
                const message = {
                    token,
                    notification: {
                        title: title || 'New Notification',
                        body: messageBody || '',
                    },
                    android: { priority: 'high' as const },
                    apns: { payload: { aps: { contentAvailable: true } } },
                };
                const fcmResponse = await messaging.send(message);
                results.fcm = `success: ${fcmResponse}`;
            } catch (e: any) {
                console.error('FCM Error:', e);
                results.fcm = `failed: ${e.message}`;
            }
        }

        // 2. Send Email via EmailJS API
        if (email) {
            try {
                const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_lx2vsyo';
                const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || 'template_x7tbqfs';
                const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'VrD4W6V_afAXyBvag';

                const templateParams = {
                    to_email: email,
                    user_name: userName || 'User',
                    task_title: taskTitle || title,
                    minutes_left: minutesLeft?.toString() || '',
                    due_time: dueTime || '',
                    subject: languageCode === 'vi'
                        ? `⏰ Nhắc nhở Deadline - ${taskTitle || title}`
                        : `⏰ Task Deadline Reminder - ${taskTitle || title}`,
                };

                const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        service_id: EMAILJS_SERVICE_ID,
                        template_id: EMAILJS_TEMPLATE_ID,
                        user_id: EMAILJS_PUBLIC_KEY,
                        template_params: templateParams,
                    }),
                });

                if (response.ok) {
                    results.email = 'success';
                } else {
                    const errorText = await response.text();
                    results.email = `failed: ${response.status} - ${errorText}`;
                }
            } catch (e: any) {
                console.error('EmailJS Error:', e);
                results.email = `failed: ${e.message}`;
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        console.error('General Error:', error);
        return NextResponse.json({ error: 'Failed to process request', details: error.message }, { status: 500 });
    }
}
