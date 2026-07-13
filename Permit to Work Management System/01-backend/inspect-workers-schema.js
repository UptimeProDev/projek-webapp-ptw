const mysql = require('mysql2/promise');
const dbConfig = { host: 'localhost', port: 3306, user: 'root', password: '', database: 'ptw' };
(async () => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute('SHOW COLUMNS FROM workers');
    console.log(JSON.stringify(rows, null, 2));
    await conn.end();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
