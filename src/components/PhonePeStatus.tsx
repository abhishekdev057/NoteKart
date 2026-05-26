"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";

type PaymentState = "CHECKING" | "COMPLETED" | "PENDING" | "FAILED" | "CANCELLED" | "ERROR" | "MISSING";

type StatusResponse = {
  normalizedState?: PaymentState;
  state?: string;
  message?: string;
  mock?: boolean;
  error?: string;
};

function getVisual(state: PaymentState) {
  if (state === "COMPLETED") {
    return {
      icon: CheckCircle2,
      className: "payment-success",
      title: "Payment received",
      body: "Your PhonePe payment is successful. NoteKart will now confirm your notebook order for production.",
    };
  }

  if (state === "FAILED") {
    return {
      icon: XCircle,
      className: "payment-failed",
      title: "Payment failed",
      body: "PhonePe did not confirm this payment. No paid order has been confirmed for this transaction.",
    };
  }

  if (state === "CANCELLED") {
    return {
      icon: XCircle,
      className: "payment-failed",
      title: "Payment cancelled",
      body: "The payment was cancelled before completion. You can go back and try again from your cart.",
    };
  }

  if (state === "ERROR") {
    return {
      icon: AlertCircle,
      className: "payment-failed",
      title: "Could not check payment",
      body: "We could not verify the payment status right now. Please try again or contact NoteKart with this reference.",
    };
  }

  if (state === "MISSING") {
    return {
      icon: AlertCircle,
      className: "payment-failed",
      title: "Payment reference missing",
      body: "The PhonePe order reference is missing from this return URL.",
    };
  }

  return {
    icon: state === "CHECKING" ? RefreshCw : Clock3,
    className: "payment-pending",
    title: state === "CHECKING" ? "Checking PhonePe status" : "Payment is pending",
    body: "We are checking PhonePe automatically. This can take a few seconds after returning from checkout.",
  };
}

export function PhonePeStatus({ merchantOrderId }: { merchantOrderId?: string }) {
  const [state, setState] = useState<PaymentState>(merchantOrderId ? "CHECKING" : "MISSING");
  const [message, setMessage] = useState("");
  const [attempts, setAttempts] = useState(0);

  const visual = useMemo(() => getVisual(state), [state]);
  const Icon = visual.icon;
  const shouldPoll = merchantOrderId && ["CHECKING", "PENDING"].includes(state) && attempts < 8;

  const checkStatus = useCallback(async () => {
    if (!merchantOrderId) return;

    setAttempts((current) => current + 1);
    try {
      const response = await fetch(`/api/payments/phonepe/status/${merchantOrderId}`, { cache: "no-store" });
      const data = (await response.json()) as StatusResponse;

      if (!response.ok) {
        setState("ERROR");
        setMessage(data.error ?? "Unable to check PhonePe status.");
        return;
      }

      const nextState = data.normalizedState ?? "PENDING";
      setState(nextState);
      setMessage(data.message ?? "");
    } catch {
      setState("ERROR");
      setMessage("Unable to connect to payment status service.");
    }
  }, [merchantOrderId]);

  useEffect(() => {
    const timer = window.setTimeout(checkStatus, 0);
    return () => window.clearTimeout(timer);
  }, [checkStatus]);

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setTimeout(checkStatus, 3000);
    return () => window.clearTimeout(timer);
  }, [shouldPoll, checkStatus]);

  return (
    <main className="policy-page payment-status-page">
      <section className={`policy-card payment-status-card ${visual.className}`}>
        <p className="policy-kicker">PhonePe payment</p>
        <div className="payment-status-icon">
          <Icon size={34} />
        </div>
        <h1>{visual.title}</h1>
        <p>{message || visual.body}</p>
        {merchantOrderId ? <p className="policy-note">Reference: {merchantOrderId}</p> : null}
        {["CHECKING", "PENDING"].includes(state) ? (
          <p className="payment-helper">Auto check attempt {Math.max(attempts, 1)} of 8</p>
        ) : null}
        <div className="payment-actions">
          {["PENDING", "ERROR"].includes(state) ? (
            <button className="secondary-button justify-center" type="button" onClick={checkStatus}>
              Check again <RefreshCw size={18} />
            </button>
          ) : null}
          <Link className="primary-button justify-center" href="/">
            Back to NoteKart
          </Link>
        </div>
      </section>
    </main>
  );
}
