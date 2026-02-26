const { defaultLogger } = require('./logger');

const STEP_ORDER = [
  'directadmin_domain',
  'copy_files',
  'supabase_project',
  'supabase_schema',
  'supabase_user',
  'replace_config',
  'insert_instance',
];

function stepIndex(name) {
  const i = STEP_ORDER.indexOf(name);
  return i >= 0 ? i : 999;
}

/**
 * Ensure provisioning step rows exist for an order (all pending).
 */
async function ensureStepRows(pool, orderId) {
  const [existing] = await pool.execute(
    'SELECT id FROM smm_provisioning_steps WHERE order_id = ? LIMIT 1',
    [orderId]
  );
  if (existing.length > 0) return;
  for (let i = 0; i < STEP_ORDER.length; i++) {
    await pool.execute(
      `INSERT INTO smm_provisioning_steps (order_id, step_name, step_order, status)
       VALUES (?, ?, ?, 'pending')`,
      [orderId, STEP_ORDER[i], i]
    );
  }
  defaultLogger.log('SMM provisioning: created step rows for order', orderId);
}

/**
 * Record step start (running).
 */
async function recordStepStart(pool, orderId, stepName) {
  await pool.execute(
    `UPDATE smm_provisioning_steps SET status = 'running', updated_at = CURRENT_TIMESTAMP
     WHERE order_id = ? AND step_name = ?`,
    [orderId, stepName]
  );
}

/**
 * Record step success or failure.
 */
async function recordStepEnd(pool, orderId, stepName, success, errorMessage = null, details = null) {
  const status = success ? 'success' : 'failed';
  const detailsJson = details ? JSON.stringify(details) : null;
  await pool.execute(
    `UPDATE smm_provisioning_steps
     SET status = ?, error_message = ?, details = ?, updated_at = CURRENT_TIMESTAMP
     WHERE order_id = ? AND step_name = ?`,
    [status, errorMessage, detailsJson, orderId, stepName]
  );
}

/**
 * Get current provisioning steps for an order.
 */
async function getSteps(pool, orderId) {
  const [rows] = await pool.execute(
    `SELECT step_name, step_order, status, error_message, details, created_at, updated_at
     FROM smm_provisioning_steps WHERE order_id = ? ORDER BY step_order`,
    [orderId]
  );
  return rows;
}

/**
 * Get order_id (smm_website_orders.id) from order_id string (order_id column) for steps table.
 */
async function getOrderIdByOrderIdString(pool, orderIdStr) {
  const [rows] = await pool.execute(
    'SELECT id FROM smm_website_orders WHERE order_id = ? LIMIT 1',
    [orderIdStr]
  );
  return rows.length ? rows[0].id : null;
}

module.exports = {
  STEP_ORDER,
  stepIndex,
  ensureStepRows,
  recordStepStart,
  recordStepEnd,
  getSteps,
  getOrderIdByOrderIdString,
};
