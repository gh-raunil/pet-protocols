import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(backendDir, ".env.local") });
dotenv.config({ path: path.join(backendDir, ".env") });

import connectDB from "../lib/db.js";
import Restaurant from "../models/Restaurant.js";
import { isValidCoordinate } from "../lib/geoDistance.js";

async function run() {
  const isExecute = process.argv.includes("--execute") || process.argv.includes("--apply");
  const modeLabel = isExecute ? "LIVE EXECUTION (WRITE MODE)" : "DRY RUN (READ-ONLY AUDIT)";

  console.log("================================================================================");
  console.log(` PET PROTOCOLS: RESTAURANT COORDINATE HYGIENE & STANDARDIZATION MIGRATION`);
  console.log(` MODE: ${modeLabel}`);
  console.log("================================================================================\n");

  if (!isExecute) {
    console.log("ℹ️  Dry-run mode is enabled by default. No database records will be modified.");
    console.log("ℹ️  To execute the proposed changes, run with the --execute flag:\n");
    console.log("    node backend/scripts/migrate_restaurant_coordinates.mjs --execute\n");
  }

  await connectDB();

  const restaurants = await Restaurant.find().lean();
  console.log(`Discovered ${restaurants.length} restaurant documents in database.\n`);

  let validPreservedCount = 0;
  let proposedChangeCount = 0;
  let unresolvedDataGaps = [];

  for (const r of restaurants) {
    const rId = r._id.toString();
    const name = r.name || "Unnamed";
    const slug = r.slug || "no-slug";
    const status = r.status || "unknown";

    const currentLat = r.address?.latitude;
    const currentLng = r.address?.longitude;
    const currentStreet = r.address?.street?.trim() || "";
    const currentCity = r.address?.city?.trim() || "";
    const currentPincode = r.address?.pincode?.trim() || "";

    const hasValidCoords = isValidCoordinate(currentLat, currentLng);
    const isZeroZero = Number(currentLat) === 0 && Number(currentLng) === 0;
    const isNullOrUndefined = currentLat === null || currentLat === undefined || currentLng === null || currentLng === undefined;

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`[Restaurant] "${name}" (slug: ${slug}, status: ${status}, ID: ${rId})`);
    console.log(`  Current Address: "${currentStreet || '<blank>'}", City: "${currentCity || '<blank>'}", PIN: "${currentPincode || '<blank>'}"`);
    console.log(`  Current Coords:  lat=${currentLat ?? 'null'}, lng=${currentLng ?? 'null'}`);

    // Coordinate check
    if (hasValidCoords) {
      validPreservedCount++;
      console.log(`  Coordinate Assessment: ✅ VALID COORDINATES PRESERVED (${currentLat}, ${currentLng})`);
    } else if (isZeroZero) {
      proposedChangeCount++;
      console.log(`  Coordinate Assessment: ⚠️  NULL ISLAND (0, 0) DETECTED`);
      console.log(`  Proposed Action:       Convert (0, 0) -> null, null to prevent false location matching`);
      
      if (isExecute) {
        await Restaurant.updateOne(
          { _id: r._id },
          { $set: { "address.latitude": null, "address.longitude": null } }
        );
        console.log(`  Applied:               ✅ Successfully updated coordinates to null, null.`);
      } else {
        console.log(`  Status:                [DRY RUN] Would update { "address.latitude": null, "address.longitude": null }`);
      }
    } else if (isNullOrUndefined) {
      console.log(`  Coordinate Assessment: ℹ️  Coordinates already null/unset. No schema normalization needed.`);
    } else {
      console.log(`  Coordinate Assessment: ⚠️  Invalid/out-of-range coordinates (${currentLat}, ${currentLng})`);
    }

    // Address completeness audit (Data Hygiene)
    const missingAddressParts = [];
    if (!currentStreet) missingAddressParts.push("street");
    if (!currentCity) missingAddressParts.push("city");
    if (!currentPincode) missingAddressParts.push("pincode");

    if (missingAddressParts.length > 0) {
      const gapReport = {
        id: rId,
        name,
        slug,
        status,
        missingFields: missingAddressParts,
        hasCoords: hasValidCoords,
        coords: hasValidCoords ? { lat: currentLat, lng: currentLng } : null,
      };
      unresolvedDataGaps.push(gapReport);
      console.log(`  Address Hygiene Gap:   ⚠️  Missing required address field(s): ${missingAddressParts.join(", ")}`);
      console.log(`  Action Required:       UNRESOLVED. Must be provided manually by owner/admin. Not auto-inventing data.`);
    }
  }

  console.log("\n================================================================================");
  console.log(" MIGRATION AUDIT SUMMARY");
  console.log("================================================================================");
  console.log(`Total restaurants inspected:      ${restaurants.length}`);
  console.log(`Valid coordinates preserved:      ${validPreservedCount}`);
  console.log(`Null Island (0, 0) cleaned:       ${proposedChangeCount} ${isExecute ? "(Applied to DB)" : "(Pending --execute)"}`);
  console.log(`Unresolved address data gaps:     ${unresolvedDataGaps.length}`);

  if (unresolvedDataGaps.length > 0) {
    console.log("\n⚠️  RECORDS REQUIRING MANUAL DATA COMPLETION:");
    for (const gap of unresolvedDataGaps) {
      console.log(`  - [${gap.status.toUpperCase()}] "${gap.name}" (${gap.slug})`);
      console.log(`    Missing: ${gap.missingFields.join(", ")}`);
      if (gap.hasCoords) {
        console.log(`    GPS Coordinates: lat=${gap.coords.lat}, lng=${gap.coords.lng} (Coordinates exist; street/pincode missing)`);
      } else {
        console.log(`    GPS Coordinates: None (Location coordinates must be configured in settings)`);
      }
    }
  }

  console.log("\n================================================================================");
  console.log(isExecute ? "✅ MIGRATION EXECUTION COMPLETED" : "✅ DRY RUN AUDIT COMPLETED SAFELY");
  console.log("================================================================================\n");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
