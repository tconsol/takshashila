import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Coins, Loader2, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { Confetti } from '../../components/games/Confetti';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { paymentsService, type PaymentCurrency } from '../../services/payments.service';

// ── Razorpay (loaded on-demand from CDN; no npm dependency) ──────────────────
interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance { open: () => void }
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}
const RAZORPAY_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = RAZORPAY_SRC;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// 1 credit = $1. INR price = credits × live USD→INR rate (fetched from the API).
// FALLBACK_RATE is only used until the live rate loads / if it's unavailable.
const FALLBACK_RATE = 94.637;
const CREDIT_PRESETS = [10, 25, 50, 100];

const PROVIDER: Record<PaymentCurrency, 'STRIPE' | 'RAZORPAY'> = { USD: 'STRIPE', INR: 'RAZORPAY' };

/** Human price label (display only — the server computes the real charge). */
function priceLabel(credits: number, currency: PaymentCurrency, rate: number): string {
  return currency === 'USD'
    ? `$${credits.toLocaleString('en-US')}`
    : `₹${(credits * rate).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function TopUpModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [currency, setCurrency] = useState<PaymentCurrency>('USD');
  const [credits, setCredits] = useState(10);
  const [busy, setBusy] = useState(false);
  const [rate, setRate] = useState(FALLBACK_RATE);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Stripe card step
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePublicId, setStripePublicId] = useState<string | null>(null);

  // Load the live USD→INR rate when the modal opens (server-cached daily).
  useEffect(() => {
    if (!open) return;
    paymentsService.getConfig()
      .then((c) => { if (c.usdInrRate > 0) setRate(c.usdInrRate); })
      .catch(() => { /* keep fallback */ });
  }, [open]);

  const provider = PROVIDER[currency];
  const price = priceLabel(credits, currency, rate);

  const reset = () => {
    setStripePromise(null);
    setClientSecret(null);
    setStripePublicId(null);
    setResult(null);
    setBusy(false);
  };
  const handleClose = () => { reset(); onClose(); };

  // Show the animated success screen, refresh the wallet, then auto-close.
  const finish = async () => {
    await qc.invalidateQueries({ queryKey: ['wallet'] });
    setBusy(false);
    setResult({ type: 'success', message: `${credits} credits added to your wallet.` });
    setTimeout(handleClose, 2400);
  };

  // Show the animated failure screen (user can retry or close).
  const fail = (message: string) => {
    setBusy(false);
    setResult({ type: 'error', message });
  };

  const handlePay = async () => {
    if (credits <= 0) return;
    setBusy(true);
    const creditsCents = credits * 100;            // wallet value; server derives the charge
    try {
      const config = await paymentsService.getConfig();

      // ── INR → Razorpay popup ───────────────────────────────────────────────
      if (provider === 'RAZORPAY') {
        if (!config.razorpayKeyId) {
          toast.error('Payments unavailable', 'Razorpay is not configured. Try USD, or contact support.');
          setBusy(false);
          return;
        }
        const ok = await loadRazorpay();
        if (!ok) { toast.error('Could not load Razorpay', 'Check your connection and retry.'); setBusy(false); return; }

        const order = await paymentsService.createOrder({ creditsCents, currency: 'INR', provider: 'RAZORPAY' });
        const rzp = new window.Razorpay!({
          key: config.razorpayKeyId,
          amount: order.amountCents,
          currency: order.currency,
          name: 'Brainbase Edu',
          description: `${credits} credits`,
          order_id: order.providerOrderId,
          theme: { color: '#6366f1' },
          handler: async (resp: RazorpayResponse) => {
            try {
              await paymentsService.verify({
                publicId: order.publicId,
                providerPaymentId: resp.razorpay_payment_id,
                providerSignature: resp.razorpay_signature,
              });
              await finish();
            } catch {
              fail('Payment captured but not verified. Contact support if you were charged.');
            }
          },
          modal: { ondismiss: () => setBusy(false) },
        });
        rzp.open();
        return;
      }

      // ── USD → Stripe Elements card form ────────────────────────────────────
      if (!config.stripePublishableKey) {
        toast.error('Payments unavailable', 'Stripe is not configured. Try INR, or contact support.');
        setBusy(false);
        return;
      }
      const order = await paymentsService.createOrder({ creditsCents, currency: 'USD', provider: 'STRIPE' });
      if (!order.clientSecret) {
        toast.error('Top-up failed', 'Could not initialize the card payment.');
        setBusy(false);
        return;
      }
      setStripePromise(loadStripe(config.stripePublishableKey));
      setClientSecret(order.clientSecret);
      setStripePublicId(order.publicId);
      setBusy(false);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      toast.error('Top-up failed', err.response?.data?.message ?? err.message ?? 'Please try again.');
      setBusy(false);
    }
  };

  const inStripeStep = !!clientSecret && !!stripePromise && !!stripePublicId;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add Credits"
      size="md"
      footer={
        result || inStripeStep ? undefined : (
          <>
            <Button variant="ghost" onClick={handleClose} disabled={busy}>Cancel</Button>
            <Button variant="gradient" onClick={handlePay} loading={busy} disabled={credits <= 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
              Pay {price}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <ResultScreen
          type={result.type}
          message={result.message}
          onRetry={() => setResult(null)}
          onClose={handleClose}
        />
      ) : inStripeStep ? (
        <Elements stripe={stripePromise!} options={{ clientSecret: clientSecret! }}>
          <StripeCardForm
            priceLabel={price}
            onSuccess={async (intentId) => {
              await paymentsService.verify({ publicId: stripePublicId!, providerPaymentId: intentId });
              await finish();
            }}
            onError={(m) => fail(m)}
            onBack={reset}
          />
        </Elements>
      ) : (
        <div className="space-y-4">
          {/* Currency / payment method */}
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Pay with</p>
            <div className="flex gap-2">
              {(['USD', 'INR'] as PaymentCurrency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold transition-all ${
                    currency === c
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'
                  }`}
                >
                  {c === 'USD' ? '$ USD' : '₹ INR'}
                  <span className="ml-1 text-[11px] font-normal text-gray-400">
                    · {PROVIDER[c] === 'STRIPE' ? 'Stripe' : 'Razorpay'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Credit presets */}
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Credits</p>
            <div className="grid grid-cols-4 gap-2">
              {CREDIT_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCredits(p)}
                  className={`flex flex-col items-center rounded-xl border-2 py-2 transition-all ${
                    credits === p
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'
                  }`}
                >
                  <span className="flex items-center gap-1 text-sm font-bold"><Coins className="h-3.5 w-3.5" />{p}</span>
                  <span className="text-[10px] text-gray-400">{priceLabel(p, currency, rate)}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Custom amount (credits)</label>
            <input
              type="number"
              min={1}
              value={credits}
              onChange={(e) => setCredits(Math.max(0, Math.floor(Number(e.target.value))))}
              className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between rounded-xl bg-brand-50 px-3.5 py-2.5 dark:bg-brand-900/20">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-300">
              <Coins className="h-4 w-4" /> {credits} credits
            </span>
            <span className="text-sm font-bold text-brand-700 dark:text-brand-300">{price}</span>
          </div>
          <p className="text-[11px] text-gray-400">
            1 credit = $1. INR is charged at the live rate (₹{rate.toFixed(2)}/credit). Credits are added once payment is confirmed.
          </p>
        </div>
      )}
    </Modal>
  );
}

// ── Animated success / failure result ───────────────────────────────────────
function ResultScreen({
  type,
  message,
  onRetry,
  onClose,
}: {
  type: 'success' | 'error';
  message: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  const ok = type === 'success';
  return (
    <div className="relative flex flex-col items-center gap-4 py-6 text-center">
      {ok && <Confetti count={28} />}

      <motion.div
        initial={{ scale: 0, rotate: ok ? -30 : 0 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14 }}
        className={`flex h-20 w-20 items-center justify-center rounded-full ${
          ok ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-rose-100 text-rose-500 dark:bg-rose-900/30'
        }`}
      >
        {ok
          ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}><CheckCircle2 className="h-11 w-11" /></motion.span>
          : <motion.span animate={{ x: [0, -6, 6, -4, 4, 0] }} transition={{ duration: 0.45, delay: 0.1 }}><XCircle className="h-11 w-11" /></motion.span>}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {ok ? 'Payment successful!' : 'Payment failed'}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{message}</p>
      </motion.div>

      {ok ? (
        <p className="text-xs text-slate-400">Closing…</p>
      ) : (
        <div className="mt-1 flex w-full gap-2">
          <Button variant="ghost" fullWidth onClick={onClose}>Close</Button>
          <Button variant="gradient" fullWidth onClick={onRetry}>Try again</Button>
        </div>
      )}
    </div>
  );
}

// ── Stripe card form (rendered inside <Elements>) ────────────────────────────
function StripeCardForm({
  priceLabel,
  onSuccess,
  onError,
  onBack,
}: {
  priceLabel: string;
  onSuccess: (intentId: string) => Promise<void>;
  onError: (msg: string) => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (error) {
      onError(error.message ?? 'Card was declined.');
      setBusy(false);
      return;
    }
    if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        await onSuccess(paymentIntent.id);
      } catch {
        onError('Payment succeeded but crediting failed. Contact support.');
      }
    } else {
      onError('Payment was not completed.');
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      {/* Amount header */}
      <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 dark:bg-brand-900/20">
        <span className="text-sm font-medium text-brand-700 dark:text-brand-300">Amount to pay</span>
        <span className="text-lg font-extrabold text-brand-700 dark:text-brand-300">{priceLabel}</span>
      </div>

      <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-700">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <Lock className="h-3 w-3" /> Payments are secured & encrypted by Stripe
      </p>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack} disabled={busy} fullWidth>Back</Button>
        <Button variant="gradient" onClick={submit} loading={busy} disabled={!stripe} fullWidth>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Pay {priceLabel}
        </Button>
      </div>
    </div>
  );
}
