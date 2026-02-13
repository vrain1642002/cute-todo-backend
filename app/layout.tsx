export const metadata = {
    title: 'Cute Todo Backend',
    description: 'Backend for Cute Todo App',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    )
}
