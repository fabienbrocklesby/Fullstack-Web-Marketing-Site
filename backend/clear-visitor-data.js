// Script to clear all visitor journey data
const fs = require("fs");
const sqlite3 = require("better-sqlite3");

try {
  console.log("Clearing visitor journey data...");

  // Open the database
  const dbFile = "./data/data.db";
  if (!fs.existsSync(dbFile)) {
    console.error("Database file not found");
    process.exit(1);
  }

  const db = new sqlite3(dbFile);

  // Get all affiliates
  const affiliates = db.prepare("SELECT id, metadata FROM affiliates").all();
  console.log(`Found ${affiliates.length} affiliates`);

  let modifiedCount = 0;

  // Process each affiliate
  affiliates.forEach((affiliate) => {
    if (!affiliate.metadata) return;

    try {
      // Parse metadata JSON
      const metadata = JSON.parse(affiliate.metadata);

      // Clear user journeys
      if (metadata.userJourneys) {
        metadata.userJourneys = {};

        // Update the affiliate record
        db.prepare("UPDATE affiliates SET metadata = ? WHERE id = ?").run(
          JSON.stringify(metadata),
          affiliate.id,
        );

        modifiedCount++;
        console.log(`Cleared journeys for affiliate ID ${affiliate.id}`);
      }
    } catch (e) {
      console.error(`Error processing affiliate ${affiliate.id}:`, e);
    }
  });

  // Close the database
  db.close();

  console.log(`Visitor data cleared for ${modifiedCount} affiliates!`);
} catch (error) {
  console.error("Error clearing visitor data:", error);
}
