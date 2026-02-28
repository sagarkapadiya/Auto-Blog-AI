import mongoose, { Schema, models, model } from "mongoose";

export interface ISettingsDoc extends mongoose.Document {
    userId: mongoose.Types.ObjectId;
    api_key: string;
    generationTime: string;
    reviewerEmail: string;
    curlCommand: string;
    deleteCurlCommand: string;
}

const SettingsSchema = new Schema<ISettingsDoc>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        api_key: { type: String, default: "" },
        generationTime: { type: String, default: "09:00" },
        reviewerEmail: { type: String, default: "" },
        curlCommand: { type: String, default: "" },
        deleteCurlCommand: { type: String, default: "" },
    },
    { timestamps: true }
);

const Settings = models.Settings || model<ISettingsDoc>("Settings", SettingsSchema);

export default Settings;
