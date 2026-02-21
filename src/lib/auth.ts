import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { connectDB } from "./db";
import User, { IUserDoc } from "@/models/User";

const JWT_SECRET = process.env.JWT_SECRET!;

export interface AuthUser {
    _id: string;
    name: string;
    email: string;
    role: "USER" | "ADMIN";
    isActive: boolean;
}

/** Sign a JWT with only the userId */
export function signToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

/** Verify JWT and fetch user from DB. Always reads role from database. */
export async function authenticate(req: NextRequest): Promise<AuthUser> {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new AuthError("No token provided", 401);
    }

    const token = authHeader.split(" ")[1];

    let decoded: { userId: string };
    try {
        decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    } catch {
        throw new AuthError("Invalid or expired token", 401);
    }

    await connectDB();
    const user = await User.findById(decoded.userId).select("-password").lean<IUserDoc>();

    if (!user) {
        throw new AuthError("User not found", 401);
    }

    if (!user.isActive) {
        throw new AuthError("Account has been deactivated", 403);
    }

    return {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
    };
}

/** Middleware: check if user has one of the required roles */
export function authorizeRoles(user: AuthUser, ...roles: string[]): void {
    if (!roles.includes(user.role)) {
        throw new AuthError("Insufficient permissions", 403);
    }
}

/** Middleware shorthand: require ADMIN role */
export function requireAdmin(user: AuthUser): void {
    authorizeRoles(user, "ADMIN");
}

/** Custom error class for auth failures */
export class AuthError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
        this.name = "AuthError";
    }
}

/** Helper to create error response from AuthError */
export function authErrorResponse(error: unknown) {
    if (error instanceof AuthError) {
        return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Unexpected auth error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
}
