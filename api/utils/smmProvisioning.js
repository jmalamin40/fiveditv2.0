const { defaultLogger } = require('./logger');

const STEP_ORDER = [
  'directadmin_domain',
  'copy_files',
  'register_tenant',
  'insert_instance',
];

function stepIndex(name) {
  const i = STEP_ORDER.indexOf(name);
  return i >= 0 ? i : 999;
}

/**
 * Ensure provisioning step rows exist for an order (all pending).
 * Inserts any step from STEP_ORDER that is missing for this order.
 */
async function ensureStepRows(pool, orderId) {
  const [existing] = await pool.execute(
    'SELECT step_name FROM smm_provisioning_steps WHERE order_id = ?',
    [orderId]
  );
  const existingNames = new Set((existing || []).map((r) => r.step_name));
  for (let i = 0; i < STEP_ORDER.length; i++) {
    if (existingNames.has(STEP_ORDER[i])) continue;
    await pool.execute(
      `INSERT INTO smm_provisioning_steps (order_id, step_name, step_order, status)
       VALUES (?, ?, ?, 'pending')`,
      [orderId, STEP_ORDER[i], i]
    );
  }
  if (STEP_ORDER.length - existingNames.size > 0) {
    defaultLogger.log('SMM provisioning: ensured step rows for order', orderId);
  }
}

/**
 * Reset any step stuck in 'running' to 'failed' so they can be retried.
 * Call at the start of a provisioning run so we never leave steps as "running".
 */
async function clearStaleRunningSteps(pool, orderId) {
  const [res] = await pool.execute(
    `UPDATE smm_provisioning_steps
     SET status = 'failed', error_message = 'Interrupted or timed out (retry to run again)', updated_at = CURRENT_TIMESTAMP
     WHERE order_id = ? AND status = 'running'`,
    [orderId]
  );
  if (res && res.affectedRows > 0) {
    defaultLogger.log('SMM provisioning: cleared stale running steps for order', orderId, res.affectedRows);
  }
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
  clearStaleRunningSteps,
  recordStepStart,
  recordStepEnd,
  getSteps,
  getOrderIdByOrderIdString,
};
