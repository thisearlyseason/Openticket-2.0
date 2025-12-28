
import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
const { Client } = pg;

dotenv.config();

const DB_CONNECTION = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

async function runSQL() {
    const client = new Client({ connectionString: DB_CONNECTION });

    try {
        await client.connect();
        console.log("Connected to DB");

        const sql = fs.readFileSync('add_affiliate_tracking.sql', 'utf8');
        console.log("Running Migration: add_affiliate_tracking.sql");

        await client.query(sql);

        console.log("Migration Complete.");
    } catch (e) {
        console.error("PG Error:", e);
    } finally {
        await client.end();
    }
}

runSQL();
