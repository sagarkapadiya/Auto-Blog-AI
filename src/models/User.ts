import mongoose, { Schema, models, model } from "mongoose";

export interface IUserDoc extends mongoose.Document {
    name: string;
    email: string;
    password: string;
    role: "USER" | "ADMIN";
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUserDoc>(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },
        role: { type: String, enum: ["USER", "ADMIN"], default: "USER" },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

const User = models.User || model<IUserDoc>("User", UserSchema);

export default User;
