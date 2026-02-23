'use client';
import { useState, useEffect } from 'react';
import { TransactionBuilder, Operation, Asset, Networks, Horizon } from '@stellar/stellar-sdk';
import { requestAccess, isConnected, signTransaction } from '@stellar/freighter-api';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const horizonServer = new Horizon.Server(HORIZON_URL);

export default function Home() {
  const [pubKey, setPubKey] = useState('');
  const [balance, setBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [txHash, setTxHash] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');

  const connectWallet = async () => {
    setIsLoading(true);
    try {
      const connected = await isConnected();
      if (!connected.isConnected) {
        setStatus('Please install Freighter and switch to Testnet.');
        setStatusType('error');
        return;
      }

      const access = await requestAccess();
      if (access.error || !access.address) {
        setStatus(access.error?.message || 'Wallet connection was rejected.');
        setStatusType('error');
        return;
      }

      setPubKey(access.address);
      await loadBalance(access.address);
      setStatus('');
      setStatusType('');
      setTxHash('');
    } catch (error) {
      setStatus('Connection failed.');
      setStatusType('error');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBalance = async (publicKey: string) => {
    try {
      const account = await horizonServer.loadAccount(publicKey);
      const xlmBalance =
        account.balances.find((b: { asset_type?: string; balance?: string }) => b.asset_type === 'native')
          ?.balance || '0';
      setBalance(xlmBalance);
    } catch (error) {
      console.error('Balance error:', error);
      setBalance('0');
    }
  };

  const disconnectWallet = () => {
    setPubKey('');
    setBalance('0');
    setStatus('');
    setStatusType('');
    setTxHash('');
  };

  const sendPayment = async () => {
    if (!pubKey || !to || !amount || Number.parseFloat(amount) <= 0) {
      setStatus('Enter valid recipient and amount.');
      setStatusType('error');
      return;
    }
    setIsLoading(true);
    try {
      const account = await horizonServer.loadAccount(pubKey);
      const tx = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(Operation.payment({
          destination: to,
          asset: Asset.native(),
          amount,
        }))
        .setTimeout(30)
        .build();
      
      const txXDR = tx.toXDR();
      const signed = await signTransaction(txXDR, {
        networkPassphrase: Networks.TESTNET,
      });
      if (signed.error || !signed.signedTxXdr) {
        throw new Error(signed.error?.message || 'Transaction signing rejected.');
      }

      const signedTx = TransactionBuilder.fromXDR(signed.signedTxXdr, Networks.TESTNET);
      const res = await horizonServer.submitTransaction(signedTx);
      
      setStatus('Transaction successful');
      setStatusType('success');
      setTxHash(res.hash);
      setTimeout(() => loadBalance(pubKey), 2000); // Refresh balance
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Failed: ${message}`);
      setStatusType('error');
      setTxHash('');
      console.error(error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (pubKey) loadBalance(pubKey);
  }, [pubKey]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full space-y-6">
        <h1 className="text-3xl font-bold text-center text-gray-900">Stellar Payment dApp</h1>
        
        {!pubKey ? (
          <button
            onClick={connectWallet}
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {isLoading ? 'Connecting...' : 'Connect Freighter'}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-xl border">
              <p className="text-sm text-gray-600 mb-1">Wallet Address</p>
              <p className="font-mono text-sm break-all">{pubKey.slice(0, 8)}...{pubKey.slice(-6)}</p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-xl border">
              <p className="text-sm text-gray-600 mb-1">Balance</p>
              <p className="text-2xl font-bold text-blue-900">{parseFloat(balance).toFixed(7)} XLM</p>
            </div>
            
            <input
              placeholder="Recipient Address (G...)"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            <input
              type="number"
              step="0.0000001"
              min="0.0000001"
              placeholder="Amount (XLM)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            
            <button
              onClick={sendPayment}
              disabled={isLoading || !to || !amount}
              className="w-full bg-green-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-all"
            >
              {isLoading ? 'Sending...' : 'Send XLM'}
            </button>
            
            {status && (
              <div className={`p-4 rounded-xl text-sm font-medium ${
                statusType === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                <p>{status}</p>
                {txHash && (
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block break-all font-mono text-xs underline"
                  >
                    {txHash}
                  </a>
                )}
              </div>
            )}
            
            <button
              onClick={disconnectWallet}
              className="w-full bg-gray-500 text-white py-2 px-4 rounded-xl font-medium hover:bg-gray-600 transition-all"
            >
              Disconnect Wallet
            </button>
          </div>
        )}
        
        <p className="text-xs text-center text-gray-500">
          Testnet only.{' '}
          <a href="https://friendbot.stellar.org" target="_blank" className="underline hover:text-blue-600">
            Fund via Friendbot
          </a>
        </p>
      </div>
    </main>
  );
}
