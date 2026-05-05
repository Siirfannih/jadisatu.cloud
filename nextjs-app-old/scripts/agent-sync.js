const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env vars manually
const envPath = path.resolve(__dirname, '../.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const [key, val] = line.split('=');
    if (key && val) env[key.trim()] = val.trim();
  });
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env['SUPABASE_SERVICE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'status') {
    const agentName = args[1];
    const status = args[2];
    if (!agentName || !status) {
      console.error('Usage: status <agent_name> <status>');
      return;
    }
    const { error } = await supabase
      .from('agents')
      .upsert({ name: agentName, status, last_active: new Date().toISOString() }, { onConflict: 'name' });
    if (error) console.error('Error updating status:', error) 
    else console.log(`Updated ${agentName} status to ${status}`);
  }
}

main();
