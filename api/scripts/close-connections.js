const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * This script attempts to close idle database connections.
 * It uses a single connection to query and potentially kill other connections.
 * 
 * WARNING: This requires appropriate MySQL privileges.
 */

async function closeConnections() {
  let connection;
  
  try {
    console.log('🔌 Attempting to connect to MySQL...');
    
    // Try to connect with a very short timeout
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      connectTimeout: 5000, // 5 second timeout
    });

    console.log('✅ Connected successfully\n');

    const dbUser = process.env.DB_USER || 'root';
    const dbName = process.env.DB_NAME || 'fivedit_db';

    // Get all connections for this user
    const [connections] = await connection.execute(
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
      WHERE USER = ? AND ID != CONNECTION_ID()
      ORDER BY TIME DESC`,
      [dbUser]
    );

    if (connections.length === 0) {
      console.log('✅ No other connections found. You should be able to run migrations now.');
      return;
    }

    console.log(`📊 Found ${connections.length} other connection(s):\n`);
    
    let closedCount = 0;
    let skippedCount = 0;

    for (const conn of connections) {
      const isIdle = conn.COMMAND === 'Sleep' || conn.STATE === null || conn.STATE === '';
      const timeSeconds = conn.TIME || 0;
      
      console.log(`Connection ID: ${conn.ID}`);
      console.log(`  Host: ${conn.HOST}`);
      console.log(`  Database: ${conn.DB || 'None'}`);
      console.log(`  Command: ${conn.COMMAND}`);
      console.log(`  Time: ${timeSeconds}s`);
      console.log(`  State: ${conn.STATE || 'Idle'}`);
      
      // Try to kill idle connections or very old connections
      if (isIdle || timeSeconds > 60) {
        try {
          await connection.execute(`KILL ?`, [conn.ID]);
          console.log(`  ✅ Killed connection ${conn.ID}\n`);
          closedCount++;
        } catch (killError) {
          if (killError.code === 'ER_NO_SUCH_THREAD') {
            console.log(`  ⚠️  Connection ${conn.ID} already closed\n`);
            skippedCount++;
          } else {
            console.log(`  ❌ Cannot kill connection ${conn.ID}: ${killError.message}\n`);
            skippedCount++;
          }
        }
      } else {
        console.log(`  ⚠️  Skipped (active connection)\n`);
        skippedCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  Closed: ${closedCount}`);
    console.log(`  Skipped: ${skippedCount}`);
    console.log(`  Total: ${connections.length}`);

    if (closedCount > 0) {
      console.log('\n✅ Some connections were closed. You can try running migrations now.');
    } else if (skippedCount === connections.length) {
      console.log('\n⚠️  All connections are active or cannot be closed.');
      console.log('   Solutions:');
      console.log('   1. Stop the API server: pkill -f "node.*server.js"');
      console.log('   2. Wait 2-5 minutes for connections to timeout');
      console.log('   3. Contact your hosting provider');
    }
    
  } catch (error) {
    if (error.code === 'ER_TOO_MANY_USER_CONNECTIONS') {
      console.error('\n❌ Cannot connect: Too many active connections');
      console.error('\n🔧 Manual Solutions:\n');
      console.error('1. Stop the API server:');
      console.error('   pkill -f "node.*server.js"');
      console.error('   # or');
      console.error('   pm2 stop all\n');
      console.error('2. Wait 2-5 minutes for MySQL to timeout idle connections\n');
      console.error('3. If you have MySQL root access, connect directly:');
      console.error(`   mysql -u root -p -h ${process.env.DB_HOST || 'localhost'}`);
      console.error('   Then run:');
      console.error(`   SHOW PROCESSLIST;`);
      console.error(`   KILL <connection_id>;  # for each connection\n`);
      console.error('4. Contact your hosting provider to:');
      console.error('   - Increase max_user_connections limit');
      console.error('   - Check for connection leaks in other applications\n');
    } else {
      console.error('❌ Error:', error.message);
      console.error('   Code:', error.code);
    }
  } finally {
    if (connection) {
      try {
        await connection.end();
        console.log('\n✅ Cleanup connection closed');
      } catch (err) {
        // Ignore errors when closing
      }
    }
  }
}

closeConnections();

