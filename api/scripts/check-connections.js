const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkConnections() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
    });

    // Get current connection count for the user
    const [rows] = await connection.execute(
      `SELECT 
        USER as user,
        COUNT(*) as connection_count,
        MAX_CONNECTIONS as max_connections
      FROM information_schema.PROCESSLIST 
      WHERE USER = ?
      GROUP BY USER`,
      [process.env.DB_USER || 'root']
    );

    console.log('\n📊 Current Database Connections:');
    console.log('─────────────────────────────────');
    
    if (rows.length > 0) {
      const userConnections = rows[0];
      console.log(`User: ${userConnections.user}`);
      console.log(`Active Connections: ${userConnections.connection_count}`);
      console.log(`Max Allowed: ${userConnections.max_connections || 'Not set'}`);
      
      if (userConnections.connection_count > 5) {
        console.log('\n⚠️  Warning: High number of active connections!');
        console.log('   Consider closing idle connections or stopping the API server.');
      }
    } else {
      console.log('No active connections found for this user.');
    }

    // Get all connections for this user
    const [allConnections] = await connection.execute(
      `SELECT 
        ID,
        USER,
        HOST,
        DB,
        COMMAND,
        TIME,
        STATE,
        INFO
      FROM information_schema.PROCESSLIST 
      WHERE USER = ?`,
      [process.env.DB_USER || 'root']
    );

    if (allConnections.length > 0) {
      console.log('\n📋 Connection Details:');
      console.log('─────────────────────────────────');
      allConnections.forEach((conn, index) => {
        console.log(`\nConnection ${index + 1}:`);
        console.log(`  ID: ${conn.ID}`);
        console.log(`  Host: ${conn.HOST}`);
        console.log(`  Database: ${conn.DB || 'None'}`);
        console.log(`  Command: ${conn.COMMAND}`);
        console.log(`  Time: ${conn.TIME}s`);
        console.log(`  State: ${conn.STATE || 'Idle'}`);
      });
    }

    console.log('\n✅ Connection check completed');
    
  } catch (error) {
    if (error.code === 'ER_TOO_MANY_USER_CONNECTIONS') {
      console.error('\n❌ Cannot check connections: Too many active connections');
      console.error('   Please wait a few minutes or contact your hosting provider.');
    } else {
      console.error('❌ Error checking connections:', error.message);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkConnections();

