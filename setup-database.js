// Database setup script for Supabase
// Run this script to automatically set up the database schema

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const setupDatabase = async () => {
    console.log('🚀 Setting up Perpology database schema...');
    
    try {
        // Test connection
        const { data, error } = await supabase.from('chats').select('count').limit(1);
        
        if (error && error.code === '42P01') {
            console.log('📋 Tables not found. Please run the SQL schema manually in Supabase dashboard.');
            console.log('📍 Go to: https://supabase.com/dashboard/project/wbtjvdwqfzhrevajzmrx/sql');
            console.log('📄 Copy and paste the contents of database/schema.sql');
            console.log('');
            console.log('✅ After running the schema, your database will be ready!');
        } else if (error) {
            console.error('❌ Database connection error:', error.message);
        } else {
            console.log('✅ Database connection successful!');
            console.log('✅ Tables already exist and are ready to use.');
        }
        
    } catch (error) {
        console.error('❌ Setup error:', error.message);
    }
};

// Instructions for manual setup
console.log('');
console.log('='.repeat(60));
console.log('📋 SUPABASE DATABASE SETUP INSTRUCTIONS');
console.log('='.repeat(60));
console.log('');
console.log('1. Go to your Supabase dashboard:');
console.log('   https://supabase.com/dashboard/project/wbtjvdwqfzhrevajzmrx');
console.log('');
console.log('2. Navigate to SQL Editor');
console.log('');
console.log('3. Copy and paste the entire contents of database/schema.sql');
console.log('');
console.log('4. Click "Run" to execute the schema');
console.log('');
console.log('5. Your database will be ready for persistent chats!');
console.log('');
console.log('='.repeat(60));
console.log('');

setupDatabase();
