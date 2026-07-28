/**
 * frontend/src/services/sandboxPaymentService.js
 * =================================================
 * Encapsulated Sandbox Payment Service for testing affiliate payout workflows
 * in development/staging environments without calling live banking or Razorpay APIs.
 *
 * Controlled via environment flag: VITE_ENABLE_SANDBOX_PAYMENTS=true
 * Easily removable in production without touching core business logic.
 */
import { backendFetch } from '../utils/api';

export const IS_SANDBOX_ENABLED = 
  import.meta.env.VITE_ENABLE_SANDBOX_PAYMENTS === 'true' || 
  import.meta.env.MODE === 'development';

export const sandboxPaymentService = {
  /**
   * Simulates an enterprise payout execution in sandbox mode.
   *
   * @param {Object} params
   * @param {string|number} params.payoutId - The withdrawal request ID
   * @param {number} params.netAmount - Calculated net payable amount
   * @param {string} params.scenario - 'success' | 'insufficient_funds' | 'bank_decline' | 'gateway_timeout'
   * @param {string} params.notes - Internal audit note
   */
  async simulatePayout({ payoutId, netAmount, scenario = 'success', notes = '' }) {
    if (!IS_SANDBOX_ENABLED) {
      throw new Error('Sandbox payment simulation is disabled in this environment.');
    }

    try {
      const response = await backendFetch(`/admin/affiliates/payouts/${payoutId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: scenario === 'success' ? 'completed' : 'failed',
          is_sandbox: true,
          scenario,
          net_amount: netAmount,
          notes: `[SANDBOX TEST] ${notes} (Scenario: ${scenario})`,
          sandbox_meta: {
            simulated_at: new Date().toISOString(),
            razorpay_payout_id: `pout_sbx_${Math.random().toString(36).substring(2, 10)}`,
            transaction_ref: `TRX-SBX-${Date.now()}`,
            provider: 'mock_sandbox',
            scenario,
          }
        }),
      });

      return {
        success: scenario === 'success',
        payoutId,
        netAmount,
        status: scenario === 'success' ? 'completed' : 'failed',
        transactionRef: `TRX-SBX-${Date.now()}`,
        razorpayPayoutId: `pout_sbx_${Math.random().toString(36).substring(2, 10)}`,
        scenario,
        message: scenario === 'success' 
          ? `[SANDBOX SUCCESS] Simulated transfer of ₹${netAmount.toFixed(2)} completed.`
          : `[SANDBOX REJECTED] Simulated payout failed with scenario: ${scenario}`
      };
    } catch (err) {
      console.warn('[SandboxPaymentService] Falling back to client simulation:', err);
      return {
        success: scenario === 'success',
        payoutId,
        netAmount,
        status: scenario === 'success' ? 'completed' : 'failed',
        transactionRef: `TRX-SBX-CLIENT-${Date.now()}`,
        razorpayPayoutId: `pout_sbx_${Math.random().toString(36).substring(2, 10)}`,
        scenario,
        message: `[SANDBOX CLIENT] Simulated ${scenario} for payout #${payoutId}`
      };
    }
  }
};
