import { NextResponse } from 'next/server';
import { messaging } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';

// Email Transporter Configuration
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            token, // FCM Token (optional if only email)
            email, // Recipient Email (optional if only push)
            title,
            body: messageBody,
            data
        } = body;

        const results = {
            fcm: 'skipped',
            email: 'skipped',
        };

        // 1. Send FCM Push Notification
        if (token) {
            try {
                const message = {
                    token,
                    notification: {
                        title: title || 'New Notification',
                        body: messageBody || '',
                    },
                    data: data || {},
                    webpush: {
                        headers: { TTL: '86400' },
                        notification: {
                            icon: '/icons/icon-192x192.png',
                            badge: '/icons/badge-72x72.png',
                        }
                    },
                    android: {
                        priority: 'high' as const,
                        notification: {
                            sound: 'default',
                            channelId: 'default_channel_id',
                        },
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: 'default',
                                contentAvailable: true,
                            },
                        },
                    },
                };
                const fcmResponse = await messaging.send(message);
                results.fcm = `success: ${fcmResponse}`;
            } catch (e: any) {
                console.error('FCM Error:', e);
                results.fcm = `failed: ${e.message}`;
            }
        }

        // 2. Send Email
        if (email) {
            try {
                if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
                    results.email = 'failed: SMTP credentials missing';
                } else {
                    await transporter.sendMail({
                        from: process.env.SMTP_FROM || '"Cute Todo" <no-reply@cutetodo.app>',
                        to: email,
                        subject: title || 'New Task Created',
                        text: messageBody || 'You have a new task.',
                        html: `
              <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #6C63FF;">${title}</h2>
                <p>${messageBody}</p>
                <hr/>
                <p style="font-size: 12px; color: #888;">Expected via Cute Todo</p>
              </div>
            `,
                    });
                    results.email = 'success';
                }
            } catch (e: any) {
                console.error('Email Error:', e);
                results.email = `failed: ${e.message}`;
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        console.error('General Error:', error);
        return NextResponse.json(
            { error: 'Failed to process request', details: error.message },
            { status: 500 }
        );
    }
}
