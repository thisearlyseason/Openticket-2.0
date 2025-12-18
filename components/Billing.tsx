
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Calendar, Package, Download, Plus, Trash2, AlertCircle, DollarSign, ArrowRight, Zap, Banknote, Clock, Wallet, FileText, CheckCircle2, Edit2, ChevronRight, Settings, Save, ExternalLink } from 'lucide-react';
import { Button, Card, Badge, Input, Select } from './UI';
import { StorageService, PLANS } from '../services/storageService';
import { Registration, Event } from '../types';

export const Billing = () => {
  const navigate = useNavigate();
  const [showAddCard, setShowAddCard] = useState(false);
  
  // Stripe State
  const [stripeId, setStripeId] = useState('');
  const [isEditingStripe, setIsEditingStripe] = useState(false);
  
  const [newCardData, setNewCardData] = useState({ number: '', expiry: '', cvc: '', name: '' });
  
  const [payoutMode, setPayoutMode] = useState<'standard' | 'instant'>('standard');
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);
  const [isPayingBalance, setIsPayingBalance] = useState(false);
  
  // Ledger State
  const [ledger, setLedger] = useState<{reg: Registration, event: Event}[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(true);

  const user = StorageService.getCurrentUser();
  
  useEffect(() => {
      const loadLedger = async () => {
          if (!user) return;
          const allEvents = await StorageService.getEvents();
          const myEvents = allEvents.filter(e => e.ownerId === user.id);
          const allRegs = await StorageService.getRegistrations();
          
          const mySales: {reg: Registration, event: Event}[] = [];
          
          myEvents.forEach(evt => {
              const evtRegs = allRegs.filter(r => r.eventId === evt.id);
              evtRegs.forEach(reg => mySales.push({ reg, event: evt }));
          });
          
          // Sort by date desc
          setLedger(mySales.sort((a,b) => b.reg.timestamp - a.reg.timestamp));
          setIsLoadingLedger(false);
          
          if(user.stripeConnectId) {
              setStripeId(user.stripeConnectId);
          } else {
              setIsEditingStripe(true);
          }
      };
      loadLedger();
  }, [user?.id]);

  if (!user || user.role !== 'organizer') {
      return (
          <div className="p-8 text-center">
              <h2 className="text-2xl font-bold">Access Denied</h2>
              <p>Only organizers can manage billing.</p>
              <Button onClick={() => navigate('/')} className="mt-4">Go Home</Button>
          </div>
      );
  }

  const sub = user.subscription || { plan: 'free', cycle: 'monthly', status: 'active', nextBillingDate: Date.now() };
  const planDetails = PLANS[sub.plan as keyof typeof PLANS];
  const balanceDue = user.balanceDue || 0;
  const availablePayout = user.availablePayout || 0;
  
  const netPayoutAvailable = Math.max(0, availablePayout - balanceDue);
  
  const instantFee = netPayoutAvailable * 0.015;
  const instantNet = netPayoutAvailable - instantFee;

  const handleSaveStripeId = async () => {
      if (!stripeId.trim()) return;
      if (!stripeId.startsWith('acct_')) {
          alert("Invalid Stripe Connect ID. It should start with 'acct_'.");
          return;
      }
      
      await StorageService.Payment.addPaymentMethod(user.id, {
          type: 'stripe',
          label: 'Stripe Connect',
          isDefault: true,
          connectedAccountId: stripeId
      });
      
      await StorageService.updateUser(user.id, { stripeConnectId: stripeId });
      alert("Stripe Connected Successfully!");
      setIsEditingStripe(false);
      window.location.reload();
  };

  const handleAddDebitCard = (e: React.FormEvent) => {
      e.preventDefault();
      const last4 = newCardData.number.slice(-4) || '4242';
      const [month, year] = newCardData.expiry.split('/').map(Number);
      
      StorageService.Payment.addInstantCard(user.id, {
          last4: last4,
          brand: 'Visa',
          expMonth: month || 12,
          expYear: year || 2030
      });
      
      setShowAddCard(false);
      alert("Debit card added for instant payouts!");
      window.location.reload();
  };

  const handlePayBalance = async () => {
      setIsPayingBalance(true);
      try {
          const success = await StorageService.Payment.payOutstandingBalance(user.id);
          if (success) {
              alert("Payment successful! Balance cleared.");
              window.location.reload();
          } else {
              alert("Payment failed. Please check your payment method or ensure you have a balance to pay.");
          }
      } catch (e: any) {
          console.error("Payment Error:", e);
          alert(`An unexpected error occurred: ${e.message || "Unknown error"}`);
      } finally {
          setIsPayingBalance(false);
      }
  };

  const handleRequestPayout = () => {
      if (netPayoutAvailable <= 0) return;
      if (payoutMode === 'instant' && !user.payoutSettings?.instantCard) {
          setShowAddCard(true);
          return;
      }
      setIsProcessingPayout(true);
      
      // Direct call without artificial delay
      (async () => {
          const result = await StorageService.Payment.requestPayout(user.id, payoutMode);
          if (result.success) {
              if (result.deducted > 0) {
                  alert(payoutMode === 'instant' 
                      ? `⚡ Payout of $${result.amount.toFixed(2)} sent! (Fee: $${result.fee.toFixed(2)}, Balance Deducted: $${result.deducted.toFixed(2)})`
                      : `Payout requested. $${result.deducted.toFixed(2)} was deducted for fees. Amount sent: $${result.amount.toFixed(2)}.`);
              } else {
                  alert(payoutMode === 'instant' 
                      ? `⚡ Payout of $${result.amount.toFixed(2)} sent to your card! Fee: $${result.fee.toFixed(2)}` 
                      : `Payout of $${result.amount.toFixed(2)} requested successfully.`);
              }
              window.location.reload();
          } else {
              alert("Payout failed.");
          }
          setIsProcessingPayout(false);
      })();
  };

  const exportLedgerCSV = () => {
      const headers = ['Date', 'Order ID', 'Event', 'Buyer', 'Email', 'Gross Amount', 'Net (Est)', 'Status'];
      const rows = ledger.map(item => {
          const r = item.reg;
          const isCancelled = r.paymentStatus === 'refunded';
          
          let gross = 0;
          let net = 0;

          if (!isCancelled) {
              gross = (r.tickets?.reduce((acc, t) => acc + (t.pricePerTicket * t.quantity), 0) || 0) 
                            + (r.donationAmount || 0) 
                            + (r.addOns?.reduce((acc, a) => acc + (a.price * a.quantity), 0) || 0)
                            + (r.taxAmount || 0)
                            + (r.customFeesAmount || 0);
              
              net = gross - (r.serviceFee || 0);
          }

          return [
              new Date(r.timestamp).toLocaleDateString(),
              r.id,
              item.event.title,
              r.attendeeName,
              r.attendeeEmail,
              isCancelled ? '0.00' : gross.toFixed(2),
              isCancelled ? '0.00' : net.toFixed(2),
              isCancelled ? 'CANCELLED' : r.paymentStatus
          ];
      });

      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `transaction_ledger_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const downloadTransaction = (item: {reg: Registration, event: Event}) => {
      const r = item.reg;
      const isCancelled = r.paymentStatus === 'refunded';
      let gross = 0;
      
      if (!isCancelled) {
          gross = (r.tickets?.reduce((acc, t) => acc + (t.pricePerTicket * t.quantity), 0) || 0) 
                      + (r.donationAmount || 0) 
                      + (r.addOns?.reduce((acc, a) => acc + (a.price * a.quantity), 0) || 0)
                      + (r.taxAmount || 0)
                      + (r.customFeesAmount || 0);
      }
      
      const headers = ['Date', 'Order ID', 'Event', 'Buyer', 'Email', 'Gross Amount', 'Status'];
      const row = [
          new Date(r.timestamp).toLocaleDateString(),
          r.id,
          item.event.title,
          r.attendeeName,
          r.attendeeEmail,
          isCancelled ? '0.00' : gross.toFixed(2),
          r.paymentStatus
      ];

      const csvContent = "data:text/csv;charset=utf-8," + [headers, row].map(e => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `transaction_${r.id}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white font-display uppercase tracking-tight">Billing & Payouts</h1>

        {balanceDue > 0 && (
            <div className="bg-red-500/10 border-l-4 border-red-500 p-4 mb-6 rounded-r-xl animate-in slide-in-from-top-2">
                <div className="flex items-start gap-3">
                    <AlertCircle className="text-red-500 mt-1" size={24}/>
                    <div>
                        <h3 className="text-red-500 font-bold uppercase">Account Locked: Outstanding Balance</h3>
                        <p className="text-white text-sm mb-2">
                            You have unpaid platform fees from offline ticket sales. 
                            <strong>Event publishing is disabled until this invoice is paid.</strong>
                        </p>
                    </div>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
                <Card className="p-6 border-l-4 border-l-primary">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Current Subscription</h2>
                            <p className="text-sm text-gray-500">Your plan and billing cycle.</p>
                        </div>
                        <Badge color={sub.plan === 'premium' ? 'purple' : sub.plan === 'pro' ? 'blue' : 'green'}>
                            {planDetails.name} Plan
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm mb-6">
                        <div className="flex items-center text-gray-600 dark:text-zinc-300">
                            <Calendar size={16} className="mr-2 text-primary" />
                            Next billing: {new Date(sub.nextBillingDate).toLocaleDateString()}
                        </div>
                        <div className="flex items-center text-gray-600 dark:text-zinc-300">
                            <DollarSign size={16} className="mr-2 text-primary" />
                            ${sub.plan === 'free' ? '0.00' : sub.cycle === 'monthly' ? planDetails.priceMonthly.toFixed(2) : planDetails.priceYearly.toFixed(2)}/{sub.cycle === 'monthly' ? 'mo' : 'yr'}
                        </div>
                    </div>
                </Card>

                {/* Direct Stripe Integration Card */}
                <div className="bg-[#635BFF] p-6 rounded-3xl text-white shadow-lg shadow-[#635BFF]/30 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="font-bold text-xl mb-1 flex items-center gap-2">Stripe Connect</h3>
                            <p className="text-white/80 text-sm">Automated payouts for ticket sales.</p>
                        </div>
                        {!isEditingStripe && user.stripeConnectId && (
                            <button onClick={() => setIsEditingStripe(true)} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                                <Settings size={12}/> Config
                            </button>
                        )}
                    </div>

                    {isEditingStripe || !user.stripeConnectId ? (
                        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm animate-in fade-in space-y-4">
                            <div className="text-xs text-white/80 leading-relaxed">
                                Enter your Stripe Connect Account ID to receive payouts. You can find this in your Stripe Dashboard under Settings.
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-white/70 uppercase mb-1">Stripe Account ID</label>
                                <div className="flex gap-2">
                                    <input 
                                        className="flex-1 bg-white text-black px-3 py-2 rounded-lg outline-none border-none text-sm font-mono placeholder:text-zinc-400"
                                        placeholder="acct_..."
                                        value={stripeId}
                                        onChange={e => setStripeId(e.target.value.trim())}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                {user.stripeConnectId && (
                                    <button 
                                        onClick={() => { setStripeId(user.stripeConnectId || ''); setIsEditingStripe(false); }}
                                        className="text-white/70 hover:text-white px-3 py-2 text-sm font-bold"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button 
                                    onClick={handleSaveStripeId}
                                    className="bg-white text-[#635BFF] px-6 py-2 rounded-lg font-bold text-sm hover:bg-white/90 shadow-md"
                                    disabled={!stripeId.startsWith('acct_')}
                                >
                                    {user.stripeConnectId ? 'Update ID' : 'Connect Account'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4 bg-white/10 p-4 rounded-xl backdrop-blur-sm">
                            <div className="w-12 h-12 bg-[#00D924] rounded-full flex items-center justify-center shadow-lg">
                                <CheckCircle2 size={24} className="text-white"/>
                            </div>
                            <div>
                                <div className="font-bold text-lg leading-tight">Payouts Active</div>
                                <div className="font-mono text-white/60 text-xs mt-1 flex items-center gap-1">
                                    ID: {user.stripeConnectId} <ExternalLink size={10}/>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Card className="p-6 bg-zinc-900 text-white border-zinc-800 h-fit">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h2 className="text-lg font-bold">Payout Balance</h2>
                        <p className="text-xs text-zinc-400">Available to withdraw</p>
                    </div>
                    <Zap size={20} className="text-[#E0FF20]" fill="currentColor"/>
                </div>
                <div className="text-4xl font-black mb-4">${availablePayout.toFixed(2)}</div>
                
                {balanceDue > 0 && (
                    <div className="bg-red-900/30 p-2 rounded-lg mb-4 text-xs text-red-300 flex justify-between">
                        <span>Owed Fees:</span>
                        <span className="font-bold">-${balanceDue.toFixed(2)}</span>
                    </div>
                )}

                {netPayoutAvailable > 0 ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                            <input type="radio" name="payout" checked={payoutMode === 'standard'} onChange={() => setPayoutMode('standard')} />
                            <div className="text-xs">
                                <div className="font-bold">Standard (2-3 Days)</div>
                                <div className="text-zinc-400">Free</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                            <input type="radio" name="payout" checked={payoutMode === 'instant'} onChange={() => setPayoutMode('instant')} />
                            <div className="text-xs">
                                <div className="font-bold flex items-center gap-1">Instant <Zap size={10} className="text-[#E0FF20]" fill="currentColor"/></div>
                                <div className="text-zinc-400">1.5% Fee (${instantFee.toFixed(2)})</div>
                            </div>
                        </div>
                        <Button 
                            onClick={handleRequestPayout} 
                            isLoading={isProcessingPayout}
                            className="w-full bg-[#E0FF20] text-black hover:bg-[#d4f542] border-none mt-2"
                        >
                            Withdraw ${payoutMode === 'instant' ? instantNet.toFixed(2) : netPayoutAvailable.toFixed(2)}
                        </Button>
                    </div>
                ) : (
                    <Button disabled className="w-full bg-zinc-800 text-zinc-500 border-none">No funds available</Button>
                )}
            </Card>
        </div>

        {balanceDue > 0 && (
            <Card className="p-6 border-red-200 dark:border-red-900">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-red-600 dark:text-red-500 flex items-center gap-2">
                            <AlertCircle size={24}/> Outstanding Invoice
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
                            You have collected offline payments that incurred platform fees. 
                            Please settle this balance to unlock your account features.
                        </p>
                    </div>
                    <div className="text-center md:text-right">
                        <div className="text-3xl font-black text-gray-900 dark:text-white mb-2">${balanceDue.toFixed(2)}</div>
                        <Button onClick={handlePayBalance} isLoading={isPayingBalance} className="bg-red-600 hover:bg-red-700 text-white border-none w-full md:w-auto">
                            Pay Now
                        </Button>
                    </div>
                </div>
            </Card>
        )}

        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="text-primary"/> Transaction Ledger
                </h2>
                <Button size="sm" variant="outline" onClick={exportLedgerCSV} disabled={ledger.length === 0}>
                    <Download size={16} className="mr-2"/> Export CSV
                </Button>
            </div>

            <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase font-bold text-xs">
                            <tr>
                                <th className="p-4">Date</th>
                                <th className="p-4">Event / Item</th>
                                <th className="p-4 text-right">Gross</th>
                                <th className="p-4 text-right">Fee</th>
                                <th className="p-4 text-right">Net</th>
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {ledger.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-zinc-500">No transactions recorded yet.</td>
                                </tr>
                            ) : (
                                ledger.map((item, idx) => {
                                    const r = item.reg;
                                    const isCancelled = r.paymentStatus === 'refunded';
                                    let gross = 0;
                                    let net = 0;
                                    
                                    if (!isCancelled) {
                                        gross = (r.tickets?.reduce((acc, t) => acc + (t.pricePerTicket * t.quantity), 0) || 0) 
                                                    + (r.donationAmount || 0) 
                                                    + (r.addOns?.reduce((acc, a) => acc + (a.price * a.quantity), 0) || 0)
                                                    + (r.customFeesAmount || 0);
                                        net = gross - (r.serviceFee || 0);
                                    }
                                    
                                    return (
                                        <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                            <td className="p-4 text-zinc-500">{new Date(r.timestamp).toLocaleDateString()}</td>
                                            <td className="p-4">
                                                <div className="font-bold text-gray-900 dark:text-white">{item.event.title}</div>
                                                <div className="text-xs text-zinc-500">Order #{r.id.slice(-6).toUpperCase()} • {r.attendeeName}</div>
                                            </td>
                                            {isCancelled ? (
                                                <>
                                                    <td className="p-4 text-right font-mono text-zinc-400 line-through">$0.00</td>
                                                    <td className="p-4 text-right font-mono text-zinc-400">-</td>
                                                    <td className="p-4 text-right font-mono text-zinc-400">$0.00</td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="p-4 text-right font-mono">${gross.toFixed(2)}</td>
                                                    <td className="p-4 text-right font-mono text-red-500">-${(r.serviceFee || 0).toFixed(2)}</td>
                                                    <td className="p-4 text-right font-mono font-bold text-green-600 dark:text-green-400">
                                                        ${net.toFixed(2)}
                                                    </td>
                                                </>
                                            )}
                                            
                                            <td className="p-4 text-center">
                                                {isCancelled ? (
                                                    <Badge color="gray">CANCELLED</Badge>
                                                ) : (
                                                    <Badge color={r.paymentStatus === 'completed' ? 'green' : 'yellow'}>
                                                        {r.paymentStatus === 'completed' ? 'PAID' : 'PENDING'}
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => downloadTransaction(item)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                                                    <Download size={16}/>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        {showAddCard && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                <Card className="w-full max-w-md p-6">
                    <h3 className="text-xl font-bold mb-4">Add Debit Card for Instant Payouts</h3>
                    <form onSubmit={handleAddDebitCard} className="space-y-4">
                        <Input 
                            label="Card Number" 
                            placeholder="0000 0000 0000 0000" 
                            value={newCardData.number}
                            onChange={e => setNewCardData({...newCardData, number: e.target.value})}
                            required
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Input 
                                label="Expiry (MM/YY)" 
                                placeholder="12/25" 
                                value={newCardData.expiry}
                                onChange={e => setNewCardData({...newCardData, expiry: e.target.value})}
                                required
                            />
                            <Input 
                                label="CVC" 
                                placeholder="123" 
                                value={newCardData.cvc}
                                onChange={e => setNewCardData({...newCardData, cvc: e.target.value})}
                                required
                            />
                        </div>
                        <Input 
                            label="Cardholder Name" 
                            placeholder="John Doe" 
                            value={newCardData.name}
                            onChange={e => setNewCardData({...newCardData, name: e.target.value})}
                            required
                        />
                        <div className="flex gap-2 justify-end mt-6">
                            <Button variant="ghost" onClick={() => setShowAddCard(false)}>Cancel</Button>
                            <Button type="submit">Save Card</Button>
                        </div>
                    </form>
                </Card>
            </div>
        )}
    </div>
  );
};
