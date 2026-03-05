// database/initDb.js - Inicialización de tablas
const fs = require('fs');
const path = require('path');
const pool = require('./connection');

async function initializeDatabase() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Remover comentarios de línea (-- ...) antes de dividir
    const cleanedSchema = schema
      .split('\n')
      .map(line => line.replace(/--.*$/, ''))
      .join('\n');

    // Dividir por sentencias (separadas por ;) y ejecutar una a una
    const statements = cleanedSchema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await pool.query(statement);
    }

    console.log('✓ Base de datos inicializada correctamente');
  } catch (error) {
    console.error('✗ Error inicializando la base de datos:', error.message);
    throw error;
  }
}

module.exports = initializeDatabase;
