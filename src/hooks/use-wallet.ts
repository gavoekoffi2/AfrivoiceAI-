"use client";

import { useState, useEffect, useCallback } from "react";

interface WalletData {
  balanceFcfa: string;
  transactions: Array<{
    id: string;
    type: string;
    amountFcfa: string;
    description: string | null;
    createdAt: string;
  }>;
}

export function useWallet() {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/wallet/balance");
      if (!res.ok) {
        throw new Error("Impossible de charger le wallet");
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  return {
    balance: data?.balanceFcfa ? parseFloat(data.balanceFcfa) : 0,
    transactions: data?.transactions ?? [],
    loading,
    error,
    refetch: fetchWallet,
  };
}
