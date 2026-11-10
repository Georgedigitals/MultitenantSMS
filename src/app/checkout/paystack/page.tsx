'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function RegistrationPaymentReturn() {
  const params = useSearchParams();
  const reference = params.get('reference') || params.get('ref') || '';
  const failed = params.get('payment') === 'failed';
  const started = useRef(false);
  const [message, setMessage] = useState(failed ? 'Paystack did not confirm this payment. No account was activated.' : 'Confirming your payment securely…');
  const [error, setError] = useState(failed ? 'Please return to registration and try again, or contact support if your account was charged.' : '');

  useEffect(() => {
    if (failed || !reference || started.current) return;
    started.current = true;
    fetch('/api/platform/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.redirectUrl) throw new Error(data.error || 'We could not confirm the payment.');
      setMessage('Payment confirmed. Opening your school dashboard…');
      window.location.assign(data.redirectUrl);
    }).catch((cause: unknown) => {
      setMessage('Payment confirmation needs attention.');
      setError(cause instanceof Error ? cause.message : 'Please contact support with your payment reference.');
    });
  }, [failed, reference]);

  return (
    <main className="min-h-screen bg-[#f7f8f6] px-5 py-20 text-[#17332a]">
      <section className="mx-auto max-w-lg rounded-2xl border border-[#dce5df] bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#28704e]">BMS · Secure payment return</p>
        <h1 className="mt-4 text-2xl font-bold">{message}</h1>
        <p className="mt-3 text-sm leading-6 text-[#52645a]">
          Your school account is created only after our server confirms the Paystack transaction and checks its amount and currency.
        </p>
        {reference && <p className="mt-5 break-all rounded-lg bg-[#f3f6f3] p-3 text-xs text-[#52645a]">Reference: {reference}</p>}
        {error && <p role="alert" className="mt-5 rounded-lg bg-[#fff3ef] p-3 text-sm text-[#9e3828]">{error}</p>}
        {error && <a className="mt-6 inline-flex rounded-lg bg-[#176b45] px-5 py-3 font-semibold text-white" href="/register">Return to registration</a>}
      </section>
    </main>
  );
}

export default function PaystackReturnPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#f7f8f6] p-12 text-[#17332a]">Checking payment…</main>}><RegistrationPaymentReturn /></Suspense>;
}
