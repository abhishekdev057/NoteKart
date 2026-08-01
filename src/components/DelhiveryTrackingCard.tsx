"use client";

import { useEffect, useState } from "react";
import { Clock3, MapPin, RefreshCw, Truck } from "lucide-react";
import type { DeliveryTrackingSummary } from "@/lib/types";

type DelhiveryTrackingCardProps = {
  orderId: string;
  waybill: string;
  admin?: boolean;
};

type TrackingResult = {
  summary: DeliveryTrackingSummary | null;
  message: string;
};

async function fetchTracking(orderId: string, waybill: string, admin: boolean): Promise<TrackingResult> {
  const response = admin
    ? await fetch("/api/delhivery/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waybill }),
      })
    : await fetch(`/api/orders/${orderId}/tracking`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      summary: null,
      message: data.error ?? "Delhivery tracking is temporarily unavailable.",
    };
  }
  return {
    summary: data.summary ?? null,
    message: data.summary ? "" : "AWB is saved. Delhivery scans will appear after the shipment is manifested.",
  };
}

function formatTrackingDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function DelhiveryTrackingCard({ orderId, waybill, admin = false }: DelhiveryTrackingCardProps) {
  const [summary, setSummary] = useState<DeliveryTrackingSummary | null>(null);
  const [message, setMessage] = useState("Loading live Delhivery tracking...");
  const [loading, setLoading] = useState(true);

  async function loadTracking() {
    setLoading(true);
    setMessage("Loading live Delhivery tracking...");
    try {
      const result = await fetchTracking(orderId, waybill, admin);
      setSummary(result.summary);
      setMessage(result.message);
    } catch {
      setSummary(null);
      setMessage("Could not connect to Delhivery. Please refresh tracking.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void fetchTracking(orderId, waybill, admin)
      .then((result) => {
        if (!active) return;
        setSummary(result.summary);
        setMessage(result.message);
      })
      .catch(() => {
        if (!active) return;
        setSummary(null);
        setMessage("Could not connect to Delhivery. Please refresh tracking.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [admin, orderId, waybill]);

  return (
    <section className="delivery-tracking-box" aria-label={`Delhivery tracking for AWB ${waybill}`}>
      <div className="delivery-tracking-head">
        <span className="delivery-tracking-icon"><Truck size={18} /></span>
        <div>
          <strong>Live Delhivery tracking</strong>
          <span>AWB {waybill}</span>
        </div>
        <button type="button" onClick={loadTracking} disabled={loading} aria-label="Refresh Delhivery tracking">
          <RefreshCw className={loading ? "tracking-spin" : ""} size={16} />
          {loading ? "Checking" : "Refresh"}
        </button>
      </div>

      {summary ? (
        <>
          <div className="delivery-tracking-current">
            <span>Current status</span>
            <strong>{summary.currentStatus}</strong>
            {summary.instructions && summary.instructions !== summary.currentStatus ? <p>{summary.instructions}</p> : null}
            <div className="delivery-tracking-facts">
              {summary.location ? <span><MapPin size={14} /> {summary.location}</span> : null}
              {summary.lastUpdated ? <span><Clock3 size={14} /> {formatTrackingDate(summary.lastUpdated)}</span> : null}
              {summary.expectedDeliveryDate ? <span><Truck size={14} /> Expected {formatTrackingDate(summary.expectedDeliveryDate)}</span> : null}
            </div>
          </div>
          {summary.scans.length ? (
            <ol className="delivery-scan-list">
              {summary.scans.map((scan, index) => (
                <li key={`${scan.dateTime ?? "scan"}-${scan.status}-${index}`}>
                  <span className="delivery-scan-dot" />
                  <div>
                    <strong>{scan.status}</strong>
                    {scan.instructions && scan.instructions !== scan.status ? <p>{scan.instructions}</p> : null}
                    {scan.location || scan.dateTime ? (
                      <small>{[scan.location, formatTrackingDate(scan.dateTime)].filter(Boolean).join(" · ")}</small>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </>
      ) : null}
      {message ? <p className="delivery-tracking-message">{message}</p> : null}
    </section>
  );
}
