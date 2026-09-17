import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { paymentsService, type PaymentConfig, type PaymentOrder } from '../services/payments.service';

const FALLBACK_RATE = 94.637;
const PRESETS = [10, 25, 50, 100];

function priceLabel(credits: number, currency: 'USD' | 'INR', rate: number): string {
  return currency === 'USD'
    ? `$${credits.toLocaleString('en-US')}`
    : `₹${(credits * rate).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

// ── Build the in-WebView checkout page for each provider ─────────────────────
function razorpayHtml(order: PaymentOrder, cfg: PaymentConfig): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0000"><script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
var rzp=new Razorpay({key:'${cfg.razorpayKeyId}',amount:${order.amountCents},currency:'${order.currency}',order_id:'${order.providerOrderId}',name:'Brainbase Edu',description:'Wallet top-up',theme:{color:'#6366F1'},
handler:function(r){window.ReactNativeWebView.postMessage(JSON.stringify({type:'success',providerPaymentId:r.razorpay_payment_id,providerSignature:r.razorpay_signature}));},
modal:{ondismiss:function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'cancel'}));}}});
rzp.open();
</script></body></html>`;
}

function stripeHtml(order: PaymentOrder, cfg: PaymentConfig): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://js.stripe.com/v3/"></script>
<style>body{font-family:-apple-system,system-ui,sans-serif;margin:0;padding:18px;background:#F8FAFC}
#pay{margin-top:18px;width:100%;padding:15px;background:#6366F1;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700}
#pay:disabled{opacity:.6}</style></head>
<body>
<div id="payment-element"></div>
<button id="pay">Pay now</button>
<script>
var stripe=Stripe('${cfg.stripePublishableKey}');
var elements=stripe.elements({clientSecret:'${order.clientSecret}'});
elements.create('payment').mount('#payment-element');
document.getElementById('pay').onclick=function(){
  var b=document.getElementById('pay');b.disabled=true;b.textContent='Processing…';
  stripe.confirmPayment({elements:elements,redirect:'if_required'}).then(function(res){
    if(res.error){b.disabled=false;b.textContent='Pay now';window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:res.error.message}));}
    else if(res.paymentIntent&&res.paymentIntent.status==='succeeded'){window.ReactNativeWebView.postMessage(JSON.stringify({type:'success',providerPaymentId:res.paymentIntent.id}));}
    else{b.disabled=false;b.textContent='Pay now';window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:'Payment not completed'}));}
  });
};
</script></body></html>`;
}

export default function BuyCreditsScreen() {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<PaymentConfig | null>(null);
  const [currency, setCurrency] = useState<'USD' | 'INR'>('INR');
  const [credits, setCredits] = useState(10);
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState<{ html: string; order: PaymentOrder } | null>(null);
  const [result, setResult] = useState<'success' | null>(null);

  const rate = cfg?.usdInrRate && cfg.usdInrRate > 0 ? cfg.usdInrRate : FALLBACK_RATE;
  const provider = currency === 'USD' ? 'STRIPE' : 'RAZORPAY';

  useEffect(() => {
    paymentsService.getConfig().then(setCfg).catch(() => setCfg(null));
  }, []);

  const startPayment = async () => {
    if (credits <= 0) return;
    const config = cfg ?? (await paymentsService.getConfig().catch(() => null));
    if (!config) { Alert.alert('Payments unavailable', 'Could not load payment config.'); return; }
    if (provider === 'RAZORPAY' && !config.razorpayKeyId) { Alert.alert('Unavailable', 'Razorpay is not configured. Try USD.'); return; }
    if (provider === 'STRIPE' && !config.stripePublishableKey) { Alert.alert('Unavailable', 'Stripe is not configured. Try INR.'); return; }

    setBusy(true);
    try {
      const order = await paymentsService.createOrder({ creditsCents: credits * 100, currency, provider });
      if (provider === 'STRIPE' && !order.clientSecret) throw new Error('Could not initialize card payment');
      const html = provider === 'RAZORPAY' ? razorpayHtml(order, config) : stripeHtml(order, config);
      setCheckout({ html, order });
    } catch (e: any) {
      Alert.alert('Top-up failed', e?.response?.data?.message ?? e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onCheckoutMessage = async (e: WebViewMessageEvent) => {
    let msg: any;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    const order = checkout?.order;
    if (!order) return;

    if (msg.type === 'cancel') { setCheckout(null); return; }
    if (msg.type === 'error') { setCheckout(null); Alert.alert('Payment failed', msg.message ?? 'Please try again.'); return; }
    if (msg.type === 'success') {
      setCheckout(null);
      try {
        await paymentsService.verify({
          publicId: order.publicId,
          providerPaymentId: msg.providerPaymentId,
          providerSignature: msg.providerSignature,
        });
        await qc.invalidateQueries({ queryKey: ['wallet'] });
        setResult('success');
      } catch {
        Alert.alert('Verification failed', 'Payment captured but not verified. Contact support if you were charged.');
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="flex-1 px-5 pt-4">
        {/* Currency */}
        <Text className="mb-2 text-sm font-semibold text-slate-700">Pay with</Text>
        <View className="mb-5 flex-row gap-3">
          {(['INR', 'USD'] as const).map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setCurrency(c)}
              className={`flex-1 rounded-2xl border-2 py-3 ${currency === c ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}
            >
              <Text className={`text-center text-base font-bold ${currency === c ? 'text-indigo-700' : 'text-slate-600'}`}>
                {c === 'INR' ? '₹ INR' : '$ USD'}
              </Text>
              <Text className="text-center text-[11px] text-slate-400">{c === 'INR' ? 'Razorpay' : 'Stripe'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Credits */}
        <Text className="mb-2 text-sm font-semibold text-slate-700">Credits</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setCredits(p)}
              className={`w-[23%] rounded-2xl border-2 py-3 ${credits === p ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}
            >
              <View className="flex-row items-center justify-center gap-1">
                <Ionicons name="pricetag" size={13} color={credits === p ? '#4338CA' : '#64748B'} />
                <Text className={`text-base font-bold ${credits === p ? 'text-indigo-700' : 'text-slate-600'}`}>{p}</Text>
              </View>
              <Text className="text-center text-[10px] text-slate-400">{priceLabel(p, currency, rate)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="mb-1 text-sm font-semibold text-slate-700">Custom (credits)</Text>
        <TextInput
          keyboardType="number-pad"
          value={String(credits)}
          onChangeText={(t) => setCredits(Math.max(0, Math.floor(Number(t) || 0)))}
          className="mb-4 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
        />

        {/* Summary */}
        <View className="mb-6 flex-row items-center justify-between rounded-2xl bg-indigo-50 px-4 py-3.5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="pricetags" size={18} color="#4338CA" />
            <Text className="text-base font-bold text-indigo-700">{credits} credits</Text>
          </View>
          <Text className="text-base font-extrabold text-indigo-700">{priceLabel(credits, currency, rate)}</Text>
        </View>

        <TouchableOpacity
          onPress={startPayment}
          disabled={busy || credits <= 0}
          className={`flex-row items-center justify-center gap-2 rounded-2xl py-4 ${busy || credits <= 0 ? 'bg-indigo-300' : 'bg-indigo-600'}`}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="lock-closed" size={18} color="#fff" />}
          <Text className="text-base font-bold text-white">Pay {priceLabel(credits, currency, rate)}</Text>
        </TouchableOpacity>

        <Text className="mt-3 text-center text-[11px] text-slate-400">
          1 credit = $1. INR at the live rate (₹{rate.toFixed(2)}/credit). Secured by {provider === 'STRIPE' ? 'Stripe' : 'Razorpay'}.
        </Text>
      </View>

      {/* Checkout WebView */}
      <Modal visible={!!checkout} animationType="slide" onRequestClose={() => setCheckout(null)}>
        <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
          <View className="flex-row items-center justify-between border-b border-slate-100 px-4 py-3">
            <Text className="text-base font-bold text-slate-900">Complete payment</Text>
            <TouchableOpacity onPress={() => setCheckout(null)}><Ionicons name="close" size={24} color="#0F172A" /></TouchableOpacity>
          </View>
          {checkout && (
            <WebView
              source={{ html: checkout.html }}
              onMessage={onCheckoutMessage}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              startInLoadingState
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Success */}
      <Modal visible={result === 'success'} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/50 px-8">
          <View className="w-full items-center rounded-3xl bg-white p-7">
            <View className="mb-3 h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <Ionicons name="checkmark-circle" size={54} color="#059669" />
            </View>
            <Text className="text-lg font-extrabold text-slate-900">Payment successful!</Text>
            <Text className="mt-1 text-center text-sm text-slate-500">{credits} credits added to your wallet.</Text>
            <TouchableOpacity
              onPress={() => { setResult(null); router.back(); }}
              className="mt-5 w-full rounded-2xl bg-indigo-600 py-3.5"
            >
              <Text className="text-center text-base font-bold text-white">Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
