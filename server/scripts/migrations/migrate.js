const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const TARGET_URI = process.env.MONGODB_URI;
const BACKUP_DIR = path.join(__dirname, '../backup');

// Helper to load documents from a JSON backup file
function loadBackupDocs(dbName, colName) {
  const filePath = path.join(BACKUP_DIR, dbName, `${colName}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error(`Error reading backup file ${filePath}:`, e);
    }
  }
  return [];
}

async function run() {
  console.log('Starting migration to target database...');
  console.log(`Target: ${TARGET_URI.replace(/:[^@]+@/, ':****@')}\n`);

  if (!fs.existsSync(BACKUP_DIR)) {
    console.error('Error: Backup directory not found. Please run the backup script first.');
    process.exit(1);
  }

  const targetClient = new MongoClient(TARGET_URI);

  try {
    console.log('Connecting to target database...');
    await targetClient.connect();
    console.log('Connected to target database successfully.');

    const destDb = targetClient.db('Vedhunt_DB');

    // Get list of all collections backed up in 'test' and 'QuickCommerce'
    const testCols = fs.readdirSync(path.join(BACKUP_DIR, 'test'))
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));

    const qCommerceCols = fs.existsSync(path.join(BACKUP_DIR, 'QuickCommerce'))
      ? fs.readdirSync(path.join(BACKUP_DIR, 'QuickCommerce'))
          .filter(f => f.endsWith('.json'))
          .map(f => f.replace('.json', ''))
      : [];

    // Union of all collections
    const allCollections = Array.from(new Set([...testCols, ...qCommerceCols]));

    console.log(`\nFound ${allCollections.length} collections to migrate.`);

    for (const colName of allCollections) {
      console.log(`\nMigrating collection: ${colName}...`);

      // Load documents from 'test' database
      const testDocs = loadBackupDocs('test', colName);
      // Load documents from 'QuickCommerce' database
      const qcDocs = loadBackupDocs('QuickCommerce', colName);

      // Merge and deduplicate by _id
      const mergedDocsMap = new Map();
      
      // Add all test documents
      testDocs.forEach(doc => {
        // Map keys are strings (usually stringified _id or the raw string)
        const idStr = doc._id?.$oid || doc._id || '';
        if (idStr) {
          mergedDocsMap.set(idStr, doc);
        } else {
          // If no id, just add with random key
          mergedDocsMap.set(Math.random().toString(), doc);
        }
      });

      // Merge in QuickCommerce documents, avoiding duplicates
      qcDocs.forEach(doc => {
        const idStr = doc._id?.$oid || doc._id || '';
        if (idStr) {
          if (!mergedDocsMap.has(idStr)) {
            mergedDocsMap.set(idStr, doc);
          } else {
            // Document already exists, skip or merge (keep the test db version as base)
            // If they are leads or subscribers, they might be different, but matching _id means same document
          }
        } else {
          mergedDocsMap.set(Math.random().toString(), doc);
        }
      });

      const docsToInsert = Array.from(mergedDocsMap.values());
      console.log(` - Merged total: ${docsToInsert.length} documents (test: ${testDocs.length}, QuickCommerce: ${qcDocs.length})`);

      if (docsToInsert.length > 0) {
        const destCollection = destDb.collection(colName);

        // Clean target collection
        console.log(` - Clearing target collection '${colName}'...`);
        await destCollection.deleteMany({});

        // Convert the stringified MongoDB Extended JSON objects back to proper Types if needed, 
        // e.g., convert $oid to ObjectId, $date to Date.
        const parsedDocs = docsToInsert.map(doc => {
          return JSON.parse(JSON.stringify(doc), (key, value) => {
            if (value && typeof value === 'object') {
              if (value.$oid) {
                const { ObjectId } = require('mongodb');
                return new ObjectId(value.$oid);
              }
              if (value.$date) {
                // If it's an object with $date, convert to Date
                if (value.$date.$numberLong) {
                  return new Date(parseInt(value.$date.$numberLong));
                }
                return new Date(value.$date);
              }
              if (value.$numberLong) {
                return parseInt(value.$numberLong);
              }
              if (value.$numberInt) {
                return parseInt(value.$numberInt);
              }
              if (value.$numberDouble) {
                return parseFloat(value.$numberDouble);
              }
            }
            return value;
          });
        });

        console.log(` - Inserting ${parsedDocs.length} documents into target '${colName}'...`);
        const result = await destCollection.insertMany(parsedDocs);
        console.log(` - Inserted ${result.insertedCount} documents successfully.`);
      } else {
        console.log(` - No documents to insert for '${colName}'.`);
      }
    }

    console.log('\nMigration completed successfully!');

  } catch (error) {
    console.error('\nERROR DURING MIGRATION:', error.message);
    if (error.message.includes('authentication failed')) {
      console.error('\n[Tip] Please verify that your MongoDB username and password are correct in your connection string.');
      console.error('[Tip] Also, ensure that your IP address is whitelisted in MongoDB Atlas Network Access settings.');
    }
  } finally {
    await targetClient.close();
    console.log('Connection closed.');
  }
}

run();
