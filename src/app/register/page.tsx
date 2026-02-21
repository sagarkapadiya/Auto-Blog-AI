"use client";

import Link from "next/link";

export default function RegisterPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-slate-100 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-200">A</div>
                        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">AutoBlog AI</h1>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200 p-8 border border-slate-100 text-center">
                    <p className="text-slate-600 font-medium">
                        Account creation is disabled. Users can only be added by an administrator.
                    </p>
                    <p className="text-slate-500 text-sm mt-2">
                        Contact your admin to get an account.
                    </p>
                    <Link
                        href="/login"
                        className="mt-6 inline-block px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors"
                    >
                        Back to Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
}
