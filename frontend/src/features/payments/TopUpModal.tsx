import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Wallet, Loader2 } from 'lucide-react';
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

// Presets + symbol per currency. amountCents = amount × 100 (dollars→cents / rupees→paise).
const CONFIG: Record<PaymentCurrency, { symbol: string; presets: number[]; default: number; provider: 'STRIPE' | 'RAZORPAY' }> = {
  USD: { symbol: '$', presets: [5, 10, 25, 50], default: 10, provider: 'STRIPE' },
  INR: { symbol: '₹', presets: [200, 500, 1000, 2500], default: 500, provider: 'RAZORPAY' },
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function TopUpModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [currency, setCurrency] = useState<PaymentCurrency>('USD');
  const [amount, setAmount] = useState(CONFIG.USD.default);
  const [busy, setBusy] = useState(false);

  // Stripe card step
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePublicId, setStripePublicId] = useState<string | null>(null);

  const cfg = CONFIG[currency];

  const pickCurrency = (c: PaymentCurrency) => {
    setCurrency(c);
    setAmount(CONFIG[c].default);
  };

  const reset = () => {
    setStripePromise(null);
    setClientSecret(null);
    setStripePublicId(null);
    setBusy(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const finish = async (msg: string) => {
    await qc.invalidateQueries({ queryKey: ['wallet'] });
    toast.success('Credits added!', msg);
    handleClose();
  };

  const handlePay = async () => {
    if (amount <= 0) return;
    setBusy(true);
    const amountCents = Math.round(amount * 100);
    try {
      const config = await paymentsService.getConfig();

      // ── INR → Razorpay popup ───────────────────────────────────────────────
      if (cfg.provider === 'RAZORPAY') {
        if (!config.razorpayKeyId) {
          toast.error('Payments unavailable', 'Razorpay is not configured. Try USD, or contact support.');
          setBusy(false);
          return;
        }
        const ok = await loadRazorpay();
        if (!ok) { toast.error('Could not load Razorpay', 'Check your connection and retry.'); setBusy(false); return; }

        const order = await paymentsService.createOrder({ amountCents, currency: 'INR', provider: 'RAZORPAY' });
        const rzp = new window.Razorpay!({
          key: config.razorpayKeyId,
          amount: order.amountCents,
          currency: order.currency,
          name: 'Brainbase Edu',
          description: `Wallet top-up — ${cfg.symbol}${amount}`,
          order_id: order.providerOrderId,
          theme: { color: '#6366f1' },
          handler: async (resp: RazorpayResponse) => {
            try {
              await paymentsService.verify({
                publicId: order.publicId,
                providerPaymentId: resp.razorpay_payment_id,
                providerSignature: resp.razorpay_signature,
              });
              await finish(`${cfg.symbol}${amount} added to your wallet.`);
            } catch {
              toast.error('Verification failed', 'Payment captured but not verified. Contact support if charged.');
              setBusy(false);
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
      const order = await paymentsService.createOrder({ amountCents, currency: 'USD', provider: 'STRIPE' });
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
      size="sm"
      footer={
        inStripeStep ? undefined : (
          <>
            <Button variant="ghost" onClick={handleClose} disabled={busy}>Cancel</Button>
            <Button variant="gradient" onClick={handlePay} loading={busy} disabled={amount <= 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              Pay {cfg.symbol}{amount}
            </Button>
          </>
        )
      }
    >
      {inStripeStep ? (
        <Elements stripe={stripePromise!} options={{ clientSecret: clientSecret! }}>
          <StripeCardForm
            amountLabel={`${cfg.symbol}${amount}`}
            onSuccess={async (intentId) => {
              await paymentsService.verify({ publicId: stripePublicId!, providerPaymentId: intentId });
              await finish(`${cfg.symbol}${amount} added to your wallet.`);
            }}
            onError={(m) => toast.error('Payment failed', m)}
            onBack={reset}
          />
        </Elements>
      ) : (
        <div className="space-y-4">
          {/* Currency */}
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Currency</p>
            <div className="flex gap-2">
              {(['USD', 'INR'] as PaymentCurrency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => pickCurrency(c)}
                  className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold transition-all ${
                    currency === c
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'
                  }`}
                >
                  {CONFIG[c].symbol} {c}
                  <span className="ml-1 text-[11px] font-normal text-gray-400">
                    · {CONFIG[c].provider === 'STRIPE' ? 'Stripe' : 'Razorpay'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount presets */}
          <div className="grid grid-cols-4 gap-2">
            {cfg.presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(p)}
                className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition-all ${
                  amount === p
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'
                }`}
              >
                {cfg.symbol}{p}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Custom amount ({cfg.symbol})</label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            Secure payment via {cfg.provider === 'STRIPE' ? 'Stripe' : 'Razorpay'}. Credits are added once payment is confirmed.
          </p>
        </div>
      )}
    </Modal>
  );
}

// ── Stripe card form (rendered inside <Elements>) ────────────────────────────
function StripeCardForm({
  amountLabel,
  onSuccess,
  onError,
  onBack,
}: {
  amountLabel: string;
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
      <PaymentElement />
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack} disabled={busy} fullWidth>Back</Button>
        <Button variant="gradient" onClick={submit} loading={busy} disabled={!stripe} fullWidth>
          Pay {amountLabel}
        </Button>
      </div>
    </div>
  );
}
