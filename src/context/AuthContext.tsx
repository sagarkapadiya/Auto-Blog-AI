"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { IUser, AuthContextType } from "@/types";
import api from "@/lib/api";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<IUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const isAdmin = user?.role === "ADMIN";

    const fetchMe = useCallback(async (t: string) => {
        try {
            const { data } = await api.get("/auth/me", {
                headers: { Authorization: `Bearer ${t}` },
            });
            setUser(data.user);
            setToken(t);
        } catch {
            localStorage.removeItem("token");
            setUser(null);
            setToken(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const savedToken = localStorage.getItem("token");
        if (savedToken) {
            fetchMe(savedToken);
        } else {
            setIsLoading(false);
        }
    }, [fetchMe]);

    const login = async (email: string, password: string) => {
        try {
            const { data } = await api.post("/auth/login", { email, password });
            localStorage.setItem("token", data.token);
            setToken(data.token);
            setUser(data.user);
        } catch (err: any) {
            throw new Error(err.response?.data?.error || "Login failed");
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, isAdmin, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
}
