import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { authenticate, requireAdmin, authErrorResponse } from "@/lib/auth";
import User from "@/models/User";
import Settings from "@/models/Settings";

/** GET /api/admin/users — List all users (ADMIN only) */
export async function GET(req: NextRequest) {
    try {
        const authUser = await authenticate(req);
        requireAdmin(authUser);

        await connectDB();
        const users = await User.find().select("-password").sort({ createdAt: -1 }).lean();

        return Response.json({ users });
    } catch (error) {
        return authErrorResponse(error);
    }
}

/** POST /api/admin/users — Create user with specified role (ADMIN only) */
export async function POST(req: NextRequest) {
    try {
        const authUser = await authenticate(req);
        requireAdmin(authUser);

        const { name, email, password, role, settings: userSettings } = await req.json();

        if (!name || !email || !password) {
            return Response.json({ error: "Name, email, and password are required" }, { status: 400 });
        }

        await connectDB();

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return Response.json({ error: "Email already exists" }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: role === "ADMIN" ? "ADMIN" : "USER",
            isActive: true,
        });

        if (userSettings && typeof userSettings === "object") {
            await Settings.create({
                userId: user._id,
                api_key: userSettings.api_key ?? "",
                generationTime: userSettings.generationTime ?? "09:00",
                reviewerEmail: userSettings.reviewerEmail ?? "",
                curlCommand: userSettings.curlCommand ?? "",
            });
        }

        return Response.json({
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt,
            },
        }, { status: 201 });
    } catch (error) {
        return authErrorResponse(error);
    }
}
