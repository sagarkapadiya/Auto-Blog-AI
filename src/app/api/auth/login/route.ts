import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { signToken } from "@/lib/auth";
import User from "@/models/User";

export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return Response.json({ error: "Email and password are required" }, { status: 400 });
        }

        await connectDB();

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return Response.json({ error: "Invalid email or password" }, { status: 401 });
        }

        if (!user.isActive) {
            return Response.json({ error: "Account has been deactivated. Contact an administrator." }, { status: 403 });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return Response.json({ error: "Invalid email or password" }, { status: 401 });
        }

        const token = signToken(user._id.toString());

        return Response.json({
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        return Response.json({ error: "Login failed" }, { status: 500 });
    }
}
