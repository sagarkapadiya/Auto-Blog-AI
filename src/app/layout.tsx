import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";

export const metadata: Metadata = {
    title: "AutoBlog AI - Automated Publishing System",
    description: "AI-powered automated blog generation, review, and publishing platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="bg-slate-50 text-slate-900 antialiased">
                <AuthProvider>
                    <ToastProvider>{children}</ToastProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
