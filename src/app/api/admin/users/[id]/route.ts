import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { authenticate, requireAdmin, authErrorResponse } from "@/lib/auth";
import User from "@/models/User";
import Settings from "@/models/Settings";

/** GET /api/admin/users/[id] — Get user with settings (ADMIN only) */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await authenticate(req);
        requireAdmin(authUser);

        const { id } = await params;

        await connectDB();

        const user = await User.findById(id).select("-password").lean();
        if (!user) {
            return Response.json({ error: "User not found" }, { status: 404 });
        }

        const settings = await Settings.findOne({ userId: id }).lean();

        return Response.json({
            user,
            settings: settings || {
                api_key: "",
                generationTime: "09:00",
                reviewerEmail: "",
                curlCommand: "",
            },
        });
    } catch (error) {
        return authErrorResponse(error);
    }
}

/** PUT /api/admin/users/[id] — Edit user (name, email, role, settings) (ADMIN only) */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await authenticate(req);
        requireAdmin(authUser);

        const { id } = await params;
        const { name, email, role, monthlyPublishLimit, settings: settingsUpdates } = await req.json();

        await connectDB();

        const user = await User.findById(id);
        if (!user) {
            return Response.json({ error: "User not found" }, { status: 404 });
        }

        if (name) user.name = name;
        if (email) user.email = email.toLowerCase();
        if (role && ["USER", "ADMIN"].includes(role)) user.role = role;
        if (typeof monthlyPublishLimit === "number" && monthlyPublishLimit >= 0) {
            user.monthlyPublishLimit = monthlyPublishLimit;
        }

        await user.save();

        if (settingsUpdates && typeof settingsUpdates === "object") {
            const defaultSettings = { api_key: "", generationTime: "09:00", reviewerEmail: "", curlCommand: "" };
            const raw = await Settings.findOne({ userId: id }).lean();
            const existing = { ...defaultSettings, ...(Array.isArray(raw) ? raw[0] : raw) };
            const merged = {
                userId: id,
                api_key: "api_key" in settingsUpdates ? (settingsUpdates.api_key ?? "") : (existing.api_key ?? ""),
                generationTime: "generationTime" in settingsUpdates ? (settingsUpdates.generationTime ?? "09:00") : (existing.generationTime ?? "09:00"),
                reviewerEmail: "reviewerEmail" in settingsUpdates ? (settingsUpdates.reviewerEmail ?? "") : (existing.reviewerEmail ?? ""),
                curlCommand: "curlCommand" in settingsUpdates ? (settingsUpdates.curlCommand ?? "") : (existing.curlCommand ?? ""),
            };
            await Settings.findOneAndUpdate({ userId: id }, merged, { upsert: true, new: true });
        }

        return Response.json({
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                monthlyPublishLimit: user.monthlyPublishLimit,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        });
    } catch (error) {
        return authErrorResponse(error);
    }
}
