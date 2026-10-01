import mongoose from "mongoose";

const PlatformSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "global",
    },
    platformName: {
      type: String,
      default: "Pet Protocols",
    },
    platformFeePercent: {
      type: Number,
      default: 5.0,
      min: 0,
      max: 50,
    },
    taxPercent: {
      type: Number,
      default: 5.0,
      min: 0,
      max: 30,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    supportEmail: {
      type: String,
      default: "support@petprotocols.in",
    },
    supportPhone: {
      type: String,
      default: "+91 98765 43210",
    },
    autoApproveRestaurants: {
      type: Boolean,
      default: false,
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata",
    },
  },
  { timestamps: true }
);

delete mongoose.models.PlatformSetting;

export default mongoose.models.PlatformSetting ||
  mongoose.model("PlatformSetting", PlatformSettingSchema);
