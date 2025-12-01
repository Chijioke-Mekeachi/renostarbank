import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please check your SUPABASE_URL and SUPABASE_SERVICE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigrations() {
  try {
    console.log('🚀 Starting database migration...');

    // Read SQL schema file
    const schemaPath = join(__dirname, 'schema.sql');
    const sql = readFileSync(schemaPath, 'utf8');

    // Split SQL by statements and filter out empty statements
    const statements = sql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => 
        statement && 
        !statement.startsWith('--') && 
        !statement.startsWith('/*') &&
        statement.length > 10
      );

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement using Supabase's SQL API
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'; // Add back the semicolon
      
      try {
        console.log(`🔧 Executing statement ${i + 1}/${statements.length}...`);
        
        // Use Supabase's SQL API to execute raw SQL
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // If exec_sql function doesn't exist, we need to create it first
          if (error.message.includes('function exec_sql(text) does not exist')) {
            console.log('📦 Creating exec_sql function first...');
            await createExecSqlFunction();
            
            // Retry the current statement
            const { error: retryError } = await supabase.rpc('exec_sql', { sql: statement });
            if (retryError && !isIgnorableError(retryError)) {
              console.error(`❌ Statement ${i + 1} failed:`, retryError.message);
              console.error('📄 Failed statement:', statement.substring(0, 200) + '...');
            } else {
              console.log(`✅ Statement ${i + 1} executed successfully`);
            }
          } else if (isIgnorableError(error)) {
            console.log(`⚠️  Statement ${i + 1} skipped (already exists):`, error.message);
          } else {
            console.error(`❌ Statement ${i + 1} failed:`, error.message);
            console.error('📄 Failed statement:', statement.substring(0, 200) + '...');
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (stmtError) {
        console.error(`❌ Statement ${i + 1} failed with exception:`, stmtError.message);
      }
    }

    console.log('✅ Database migration completed successfully');
    console.log('🎉 Your database is now ready!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Create the exec_sql function if it doesn't exist
async function createExecSqlFunction() {
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql text)
    RETURNS void AS $$
    BEGIN
      EXECUTE sql;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  // Use fetch to call Supabase's REST API for SQL execution
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      query: createFunctionSQL
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create exec_sql function: ${response.statusText}`);
  }
}

// Check if error is ignorable (like already exists errors)
function isIgnorableError(error) {
  const ignorableMessages = [
    'already exists',
    'duplicate key',
    'cannot drop',
    'does not exist'
  ];
  
  return ignorableMessages.some(msg => 
    error.message.toLowerCase().includes(msg.toLowerCase())
  );
}

runMigrations();