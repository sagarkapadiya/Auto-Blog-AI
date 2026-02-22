"use client";

import { useState } from "react";
import { useToast } from "@/context/ToastContext";
import api from "@/lib/api";
import { ICONS } from "@/lib/constants";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

interface PasswordRequirement {
    label: string;
    test: (pw: string) => boolean;
}

const requirements: PasswordRequirement[] = [
    { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
    { label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
    { label: "One lowercase letter", test: (pw) => /[a-z]/.test(pw) },
    { label: "One number", test: (pw) => /\d/.test(pw) },
    { label: "One special character", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export default function ChangePassword() {
    const { toast } = useToast();

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const isStrongPassword = PASSWORD_REGEX.test(newPassword);
    const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
    const isSameAsCurrent = newPassword.length > 0 && currentPassword === newPassword;

    const canSubmit =
        currentPassword.length > 0 &&
        isStrongPassword &&
        passwordsMatch &&
        !isSameAsCurrent &&
        !isLoading;

    const clearForm = () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowCurrent(false);
        setShowNew(false);
        setShowConfirm(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setIsLoading(true);
        try {
            const { data } = await api.post("/auth/change-password", {
                currentPassword,
                newPassword,
                confirmPassword,
            });

            if (data.success) {
                toast.success(data.message || "Password updated successfully");
                clearForm();
            }
        } catch (error: any) {
            const msg =
                error.response?.data?.error || error.message || "Failed to change password";
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-xl">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-800">Change Password</h2>
                <p className="text-slate-500 mt-1">
                    Update your password to keep your account secure.
                </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Current Password */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-1.5">
                            Current Password
                        </label>
                        <div className="relative">
                            <input
                                type={showCurrent ? "text" : "password"}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter your current password"
                                className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrent(!showCurrent)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                                tabIndex={-1}
                            >
                                {showCurrent ? (
                                    <ICONS.EyeOff className="w-5 h-5" />
                                ) : (
                                    <ICONS.Eye className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* New Password */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-1.5">
                            New Password
                        </label>
                        <div className="relative">
                            <input
                                type={showNew ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter a strong new password"
                                className={`w-full px-4 py-3 pr-12 border rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${newPassword.length > 0 && !isStrongPassword
                                        ? "border-rose-300 bg-rose-50/30"
                                        : newPassword.length > 0 && isStrongPassword
                                            ? "border-emerald-300 bg-emerald-50/30"
                                            : "border-slate-200"
                                    }`}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNew(!showNew)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                                tabIndex={-1}
                            >
                                {showNew ? (
                                    <ICONS.EyeOff className="w-5 h-5" />
                                ) : (
                                    <ICONS.Eye className="w-5 h-5" />
                                )}
                            </button>
                        </div>

                        {/* Password requirements */}
                        {newPassword.length > 0 && (
                            <div className="mt-3 p-4 bg-slate-50 rounded-xl space-y-2">
                                {requirements.map((req) => {
                                    const passed = req.test(newPassword);
                                    return (
                                        <div key={req.label} className="flex items-center gap-2 text-xs">
                                            {passed ? (
                                                <ICONS.Check className="w-3.5 h-3.5 text-emerald-500" />
                                            ) : (
                                                <ICONS.X className="w-3.5 h-3.5 text-slate-300" />
                                            )}
                                            <span
                                                className={
                                                    passed
                                                        ? "text-emerald-600 font-medium"
                                                        : "text-slate-400"
                                                }
                                            >
                                                {req.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {isSameAsCurrent && (
                            <p className="mt-2 text-xs text-rose-500 font-medium flex items-center gap-1">
                                <ICONS.X className="w-3.5 h-3.5" />
                                New password must be different from the current password
                            </p>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-1.5">
                            Confirm New Password
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirm ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter your new password"
                                className={`w-full px-4 py-3 pr-12 border rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${confirmPassword.length > 0 && !passwordsMatch
                                        ? "border-rose-300 bg-rose-50/30"
                                        : confirmPassword.length > 0 && passwordsMatch
                                            ? "border-emerald-300 bg-emerald-50/30"
                                            : "border-slate-200"
                                    }`}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(!showConfirm)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                                tabIndex={-1}
                            >
                                {showConfirm ? (
                                    <ICONS.EyeOff className="w-5 h-5" />
                                ) : (
                                    <ICONS.Eye className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                        {confirmPassword.length > 0 && !passwordsMatch && (
                            <p className="mt-2 text-xs text-rose-500 font-medium flex items-center gap-1">
                                <ICONS.X className="w-3.5 h-3.5" />
                                Passwords do not match
                            </p>
                        )}
                    </div>

                    {/* Submit */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className={`w-full py-3.5 font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${canSubmit
                                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                                    : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                                }`}
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Updating Password…
                                </>
                            ) : (
                                <>
                                    <ICONS.Lock className="w-5 h-5" />
                                    Update Password
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
