import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local so we connect to the same DB as the app
config({ path: resolve(__dirname, "../../.env.local") });

const MONGODB_URI = process.env.MONGODB_URI as string;
if (!MONGODB_URI) {
    console.error("ERROR: MONGODB_URI not found. Make sure .env.local exists.");
    process.exit(1);
}

async function seed() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);

    const UserModel = mongoose.models.User || mongoose.model("User", new mongoose.Schema({
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true, lowercase: true },
        password: { type: String, required: true },
        role: { type: String, enum: ["USER", "ADMIN"], default: "USER" },
        isActive: { type: Boolean, default: true },
    }, { timestamps: true }));

    const adminEmail = "admin@gmail.com";
    const existing = await UserModel.findOne({ email: adminEmail });

    if (existing) {
        console.log("Admin user already exists:", adminEmail);
    } else {
        const hashedPassword = await bcrypt.hash("admin@123", 12);
        await UserModel.create({
            name: "Admin",
            email: adminEmail,
            password: hashedPassword,
            role: "ADMIN",
            isActive: true,
        });
        console.log("✅ Admin user created!");
        console.log("   Email:    admin@gmail.com");
        console.log("   Password: admin@123");
    }

    await mongoose.disconnect();
    console.log("Done.");
}

seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
