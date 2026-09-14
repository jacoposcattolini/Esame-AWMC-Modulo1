/**
 * Hashing delle password con bcrypt.
 *
 * Si usa il modulo nativo `bcrypt`; se sulla macchina il binario nativo non e'
 * compilabile si ricade su `bcryptjs`, che implementa lo stesso algoritmo e
 * produce/verifica gli stessi hash `$2b$`.
 */
let bcrypt;
try {
  bcrypt = require('bcrypt');
  console.log('[auth] hashing password con bcrypt (modulo nativo)');
} catch (err) {
  bcrypt = require('bcryptjs');
  console.log('[auth] bcrypt nativo non disponibile, uso bcryptjs (stesso algoritmo)');
}

const SALT_ROUNDS = 10;

function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, verifyPassword };
