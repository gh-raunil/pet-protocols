import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
        },

        password: {
            type: String,
        },

        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
        },

        image: {
            type: String,
        },

        phone: {
            type: String, 
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);