/**
 * paymentService.js
 * Bridges appointments ↔ PayMongo. Owns the payments table writes.
 *
 *   createCheckoutSession(appointmentId, userId)  → { checkoutUrl, transactionId, amount }
 *   getStatus(appointmentId, userId)              → { paymentStatus, appointmentStatus, payment }
 *   reconcileFromPayMongo(transactionId)          → polling fallback when no webhook
 *   markPaid(transactionId, eventPayload)         → called by webhook handler (Phase 4)
 */
const { supabaseAdmin } = require('../config/supabase');
const paymongo = require('./paymongoClient');
const { getPrice: getStaticPrice, formatPHP } = require('../config/pricing');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

const FRONTEND = () => process.env.PAYMONGO_RETURN_URL || process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Get price from database services table, fallback to static pricing
 */
async function getPriceFromDb(serviceName) {
  try {
    const { data, error } = await supabaseAdmin
      .from('services')
      .select('price')
      .eq('label', serviceName)
      .eq('is_active', true)
      .single();

    if (error) throw error;
    if (data?.price !== null && data?.price !== undefined) {
      return Math.round(data.price * 100); // Convert to centavos
    }
  } catch (e) {
    logger.warn('payment.getPrice', 'Failed to load price from DB, using fallback', { msg: e.message, serviceName });
  }
  return null;
}

/**
 * Get price for a service: try DB first, then static config
 */
async function getPrice(serviceName) {
  const dbPrice = await getPriceFromDb(serviceName);
  if (dbPrice !== null) return dbPrice;

  return getStaticPrice(serviceName);
}

async function loadOwnedAppointment(appointmentId, userId) {
  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('id, type, service, amount, status, payment_status, client_id, vet_id, pet_id, appointment_at, pets(name), vet:users!appointments_vet_id_fkey(id, name)')
    .eq('id', appointmentId)
    .single();
  if (error || !data) throw new Error('Appointment not found');
  if (userId && data.client_id !== userId) throw new Error('Access denied');
  return data;
}

const paymentService = {
  /**
   * Create a checkout session for an unpaid appointment.
   * If amount is 0, short-circuits to "paid" without calling PayMongo.
   */
  async createCheckoutSession(appointmentId, userId) {
    const appt = await loadOwnedAppointment(appointmentId, userId);

    if (appt.payment_status === 'paid') {
      throw new Error('This appointment is already paid.');
    }

    // Determine amount
    const serviceName = appt.service || appt.type || 'General Checkup';
    let amount = appt.amount;
    if (!amount || amount <= 0) {
      amount = getPrice(serviceName);
      if (amount === null) throw new Error('No price configured for service: ' + serviceName);
      // Persist the resolved amount on the appointment
      await supabaseAdmin.from('appointments')
        .update({ amount, service: serviceName, payment_status: 'pending' })
        .eq('id', appointmentId);
    } else if (appt.payment_status !== 'pending') {
      // Make sure the row reflects a pending payment now
      await supabaseAdmin.from('appointments')
        .update({ payment_status: 'pending' })
        .eq('id', appointmentId);
    }

    // Free tier short-circuit (helpful for ₱0 demos)
    if (amount === 0) {
      await supabaseAdmin.from('appointments')
        .update({ payment_status: 'paid', status: 'confirmed' })
        .eq('id', appointmentId);
      return { checkoutUrl: null, transactionId: null, amount: 0, free: true };
    }

    // Build PayMongo checkout
    const successUrl = `${FRONTEND()}/client/payment/success?appointmentId=${appointmentId}`;
    const cancelUrl  = `${FRONTEND()}/client/payment/failed?appointmentId=${appointmentId}`;
    const description = `${serviceName} for ${appt.pets?.name || 'pet'}${appt.vet?.name ? ' with ' + appt.vet.name : ''}`;
    // Coerce amount to number — DB numeric columns can return strings
    const amountNum = Number(amount);
    const lineItems = [{
      currency: 'PHP',
      amount: amountNum,
      name: serviceName,
      quantity: 1,
      description,
    }];

    const sessionData = await paymongo.createCheckoutSession({
      amount: amountNum,
      description,
      lineItems,
      successUrl,
      cancelUrl,
      referenceNumber: appointmentId,
      metadata: { appointmentId, userId, service: serviceName },
    });

    const checkoutUrl   = sessionData?.attributes?.checkout_url;
    const transactionId = sessionData?.id;
    if (!checkoutUrl || !transactionId) throw new Error('PayMongo returned no checkout URL');

    // Upsert payment row (idempotent on transaction_id)
    const { error: upsertErr } = await supabaseAdmin
      .from('payments')
      .upsert({
        appointment_id: appointmentId,
        user_id:        userId,
        pet_id:         appt.pet_id || null,
        transaction_id: transactionId,
        amount,
        currency:       'PHP',
        status:         'pending',
      }, { onConflict: 'transaction_id' });
    if (upsertErr) logger.warn('payment', 'payments upsert failed', { msg: upsertErr.message });

    logger.info('payment', 'checkout session created', {
      appointmentId, userId, transactionId, amount, displayPrice: formatPHP(amount),
    });

    return { checkoutUrl, transactionId, amount, displayPrice: formatPHP(amount) };
  },

  /**
   * Read the current payment + appointment state. Used by the success page.
   * If `forceReconcile=true` and payment is pending, ask PayMongo for the latest
   * (the polling fallback for environments without a public webhook URL).
   */
  async getStatus(appointmentId, userId, { forceReconcile = false } = {}) {
    const appt = await loadOwnedAppointment(appointmentId, userId);

    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (forceReconcile && payment?.status === 'pending' && payment.transaction_id) {
      try {
        await paymentService.reconcileFromPayMongo(payment.transaction_id);
        // Re-read after reconcile
        const { data: refreshed } = await supabaseAdmin
          .from('payments').select('*').eq('id', payment.id).single();
        const { data: refreshedAppt } = await supabaseAdmin
          .from('appointments').select('id, status, payment_status, amount').eq('id', appointmentId).single();
        return {
          paymentStatus:     refreshed?.status,
          appointmentStatus: refreshedAppt?.status,
          payment:           refreshed,
          appointment:       { ...appt, ...refreshedAppt },
        };
      } catch (e) {
        logger.warn('payment', 'reconcile failed', { msg: e.message });
      }
    }

    return {
      paymentStatus:     payment?.status || appt.payment_status || 'unpaid',
      appointmentStatus: appt.status,
      payment,
      appointment:       appt,
    };
  },

  /**
   * Polling fallback: ask PayMongo about a checkout session and update DB.
   * PayMongo's checkout_session has `attributes.payments[]` — when populated
   * with status="paid", we mark the local payment as paid.
   */
  async reconcileFromPayMongo(transactionId) {
    const data = await paymongo.retrieveCheckoutSession(transactionId);
    const payments  = data?.attributes?.payments || [];
    const lastPaid  = payments.find(p => p?.attributes?.status === 'paid');
    if (!lastPaid) {
      logger.info('payment.reconcile', 'no paid payment yet', { transactionId, count: payments.length });
      return { paid: false };
    }

    const method = lastPaid?.attributes?.source?.type
                 || lastPaid?.attributes?.payment_method_used
                 || 'unknown';

    return paymentService.markPaid(transactionId, {
      reason:          'reconcile',
      payment_method:  method,
      raw:             { checkout_session: data, payment: lastPaid },
    });
  },

  /**
   * Mark a payment paid + transition the appointment to confirmed.
   * Idempotent — if already paid, returns the existing record.
   * Used by the webhook handler (Phase 4) and the polling reconciler.
   */
  async markPaid(transactionId, { reason = 'webhook', payment_method, raw } = {}) {
    // Find the payment
    const { data: existing } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('transaction_id', transactionId)
      .single();
    if (!existing) throw new Error('No payment with transaction_id ' + transactionId);
    if (existing.status === 'paid') {
      return { paid: true, alreadyPaid: true, payment: existing };
    }

    // Load the appointment so we can associate pet + build the invoice
    const { data: apptData } = await supabaseAdmin
      .from('appointments')
      .select('id, type, service, amount, status, payment_status, client_id, vet_id, pet_id, appointment_at, pets(name)')
      .eq('id', existing.appointment_id)
      .single();

    // Update payment row
    const { data: updatedPayment, error: payErr } = await supabaseAdmin
      .from('payments')
      .update({
        status:         'paid',
        payment_method: payment_method || existing.payment_method,
        pet_id:         existing.pet_id || apptData?.pet_id || null,
        raw_event:      raw || existing.raw_event,
        paid_at:        new Date().toISOString(),
      })
      .eq('transaction_id', transactionId)
      .select()
      .single();
    if (payErr) throw new Error('Failed to mark paid: ' + payErr.message);

    // Build the invoice: line item for the appointment service + generate record
    await paymentService.generateInvoice({
      payment: updatedPayment,
      appointment: apptData,
      petId: apptData?.pet_id || existing.pet_id,
      userId: existing.user_id,
      method: payment_method || existing.payment_method,
    });

    // Transition appointment
    const { data: appt } = await supabaseAdmin
      .from('appointments')
      .update({
        payment_status:    'paid',
        status:            'confirmed',
        status_updated_at: new Date().toISOString(),
        approved_by:       existing.user_id,
      })
      .eq('id', existing.appointment_id)
      .select('id, client_id, vet_id, type, service, appointment_at, pets(name)')
      .single();

    logger.info('payment.markPaid', 'paid', {
      transactionId, appointmentId: existing.appointment_id, reason, method: payment_method,
    });

    // Fire the existing notification + SMS pipeline
    if (appt?.client_id) {
      const petName = appt.pets?.name || 'your pet';
      const dateStr = appt.appointment_at
        ? new Date(appt.appointment_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';
      await notificationService.createWithSMS(appt.client_id, {
        title:   'Payment Received',
        message: `Payment received for ${petName}${dateStr ? ' on ' + dateStr : ''}. Your appointment is confirmed.`,
        type:    'success',
        link:    '/client/appointments',
        smsBody: `PHVC: Payment received. Your appointment for ${petName}${dateStr ? ' on ' + dateStr : ''} is CONFIRMED.`,
      });
    }

    return { paid: true, alreadyPaid: false, payment: updatedPayment };
  },

  /**
   * Mark a payment failed (called by webhook on failed events).
   */
  async markFailed(transactionId, { reason, raw } = {}) {
    const { data: existing } = await supabaseAdmin
      .from('payments').select('*').eq('transaction_id', transactionId).single();
    if (!existing || existing.status === 'paid') return;
    await supabaseAdmin
      .from('payments')
      .update({ status: 'failed', raw_event: raw || existing.raw_event })
      .eq('transaction_id', transactionId);
    logger.info('payment.markFailed', 'failed', { transactionId, reason });
  },

  /**
   * Generate an invoice record for a completed payment.
   * Associates the payment with owner, pet, appointment, and invoice per spec.
   * Idempotent — if an invoice already exists for the payment, it returns it.
   */
  async generateInvoice({ payment, appointment, petId, userId, method }) {
    try {
      const { data: existingInvoice } = await supabaseAdmin
        .from('invoices')
        .select('*')
        .eq('payment_id', payment.id)
        .maybeSingle();
      if (existingInvoice) return existingInvoice;

      const serviceName = appointment?.service || appointment?.type || 'Veterinary Service';
      const items = [{
        description: serviceName,
        amount:      payment.amount,
        quantity:    1,
        metadata:    {
          appointmentId: appointment?.id || payment.appointment_id,
          petId:        petId || null,
          method:       method || null,
        },
      }];

      const invNumRes = await supabaseAdmin.rpc('generate_invoice_number');
      const invoiceNumber = invNumRes.data || `INV-${Date.now()}`;

      const { data: invoice, error: invErr } = await supabaseAdmin
        .from('invoices')
        .insert({
          payment_id:     payment.id,
          appointment_id: payment.appointment_id,
          user_id:        userId,
          pet_id:         petId || null,
          invoice_number: invoiceNumber,
          amount:         payment.amount,
          currency:       payment.currency || 'PHP',
          status:         'paid',
          items,
          paid_at:        payment.paid_at || new Date().toISOString(),
        })
        .select()
        .single();

      if (invErr) {
        logger.warn('payment.generateInvoice', 'invoice insert failed', { msg: invErr.message });
        return null;
      }

      logger.info('payment.generateInvoice', 'invoice created', {
        invoiceNumber, paymentId: payment.id, appointmentId: payment.appointment_id,
      });
      return invoice;
    } catch (e) {
      logger.warn('payment.generateInvoice', 'error', { msg: e.message });
      return null;
    }
  },
};

module.exports = paymentService;
