
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { Event, Registration, PurchasedTicket, PurchasedAddOn, PromoCode, User } from '../types';
import { Button, Input, Select, Card, Badge, formatTime, ReceiptModal } from './UI';
import { Calendar, MapPin, Clock, Share2, Ticket, Check, AlertCircle, Info, Lock, Users, Printer } from 'lucide-react';

export const EventView = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [organizerUser, setOrganizerUser] = useState<User | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  
  // Registration State
  const [ticketSelection, setTicketSelection] = useState<Record<string, number>>({});
  const [assignments, setAssignments] = useState<Record<string, {name: string, email: string}[]>>({});
  
  const [addOnSelection, setAddOnSelection] = useState<Record<string, { qty: number, answer: string }>>({});
  const [regData, setRegData] = useState({
      name: '', email: '', phoneNumber: '', 
      donation: '', platformDonationAmount: 0, 
      answers: {} as Record<string, any>, 
      waiverAgreed: false
  });
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [newCredentials, setNewCredentials] = useState<{email: string, password: string} | undefined>(undefined);
  const [completedRegistration, setCompletedRegistration] = useState<Registration | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
      const loadEvent = async () => {
          if (id) {
              const e = await StorageService.getEventById(id);
              if (e) {
                  setEvent(e);
                  const user = await StorageService.getUserById(e.ownerId);
                  setOrganizerUser(user);
              }
          }
          setLoading(false);
      };
      loadEvent();
  }, [id]);

  // Affiliate Tracking
  useEffect(() => {
      const refCode = searchParams.get('ref');
      if (refCode && event) {
          sessionStorage.setItem(`active_ref_${event.id}`, refCode);
          if (!sessionStorage.getItem(`tracked_click_${event.id}_${refCode}`)) {
              StorageService.trackAffiliateClick(event.id, refCode);
              sessionStorage.setItem(`tracked_click_${event.id}_${refCode}`, 'true');
          }
      }
  }, [event, searchParams]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!event) return <div className="p-8 text-center">Event not found.</div>;

  const handleTicketChange = (tierId: string, qty: number) => {
      setTicketSelection(prev => ({ ...prev, [tierId]: qty }));
      
      setAssignments(prev => {
          const current = prev[tierId] || [];
          if (qty > current.length) {
              const newSlots = Array(qty - current.length).fill({name: '', email: ''});
              return { ...prev, [tierId]: [...current, ...newSlots] };
          } else if (qty < current.length) {
              return { ...prev, [tierId]: current.slice(0, qty) };
          }
          return prev;
      });
  };

  const handleAssignmentChange = (tierId: string, index: number, field: 'name' | 'email', value: string) => {
      setAssignments(prev => {
          const tierAssignments = [...(prev[tierId] || [])];
          while(tierAssignments.length <= index) {
              tierAssignments.push({name: '', email: ''});
          }
          const current = tierAssignments[index] || {name: '', email: ''};
          tierAssignments[index] = { ...current, [field]: value };
          return { ...prev, [tierId]: tierAssignments };
      });
  };

  const handleApplyPromo = () => {
      if(!promoCode) return;
      const code = event.promoCodes?.find(p => p.code === promoCode);
      if(code) {
          if(code.maxUsage && code.usageCount >= code.maxUsage) {
              alert("This code has reached its usage limit.");
              return;
          }
          setAppliedPromo(code);
      } else {
          alert("Invalid code.");
      }
  };

  const calculateTotal = () => {
      let total = 0;
      if (event.priceType === 'fixed') {
          const qty = ticketSelection['general'] || 0;
          total += qty * event.price;
      } else if (event.priceType === 'tiered') {
          event.ticketTiers?.forEach(tier => {
              total += (ticketSelection[tier.id] || 0) * tier.price;
          });
      } else if (event.priceType === 'donation') {
          total += Number(regData.donation) || 0;
      }

      event.addOns?.forEach(addon => {
          const sel = addOnSelection[addon.id];
          if (sel) total += sel.qty * addon.price;
      });

      if (appliedPromo) {
          if (appliedPromo.type === 'percent') {
              total -= total * (appliedPromo.value / 100);
          } else {
              total -= appliedPromo.value;
          }
      }
      
      if (event.taxRate) {
          total += total * (event.taxRate / 100);
      }

      if (!event.absorbFees && event.priceType !== 'free' && event.priceType !== 'donation') {
          const plan = organizerUser?.subscription?.plan || 'free'; 
          total += StorageService.calculateFees(total, plan); 
      }

      return Math.max(0, total);
  };

  const handleRegister = async () => {
      if (!regData.name || !regData.email) return alert("Please fill in your details.");
      
      setIsRegistering(true);
      
      try {
          const tickets: PurchasedTicket[] = [];
          
          if (event.priceType === 'tiered') {
              event.ticketTiers?.forEach(tier => {
                  const qty = ticketSelection[tier.id] || 0;
                  if (qty > 0) {
                      const tierAssignments = assignments[tier.id] || [];
                      for (let i = 0; i < qty; i++) {
                          const assignment = tierAssignments[i] || { name: '', email: '' };
                          tickets.push({
                              tierId: tier.id,
                              name: tier.name,
                              pricePerTicket: tier.price,
                              quantity: 1, 
                              attendeeName: assignment.name || (i === 0 ? regData.name : 'Guest'), 
                              attendeeEmail: assignment.email
                          });
                      }
                  }
              });
          } else if (event.priceType === 'fixed' || event.priceType === 'donation' || event.priceType === 'free') {
               const qty = ticketSelection['general'] || 1; 
               if (qty > 0) {
                   const tierAssignments = assignments['general'] || [];
                   for (let i = 0; i < qty; i++) {
                       const assignment = tierAssignments[i] || { name: '', email: '' };
                       tickets.push({
                           tierId: 'general',
                           name: event.ticketName || 'General Admission',
                           pricePerTicket: event.priceType === 'donation' ? 0 : event.price,
                           quantity: 1,
                           attendeeName: assignment.name || (i === 0 ? regData.name : 'Guest'),
                           attendeeEmail: assignment.email
                       });
                   }
               }
          }

          const groupedTickets: PurchasedTicket[] = [];
          tickets.forEach(t => {
              const existing = groupedTickets.find(g => 
                  g.tierId === t.tierId && 
                  g.attendeeName === t.attendeeName && 
                  g.attendeeEmail === t.attendeeEmail
              );
              if (existing) {
                  existing.quantity += 1;
              } else {
                  groupedTickets.push(t);
              }
          });

          const purchasedAddOns: PurchasedAddOn[] = [];
          event.addOns?.forEach(addon => {
              const sel = addOnSelection[addon.id];
              if (sel && sel.qty > 0) {
                  purchasedAddOns.push({
                      id: addon.id,
                      name: addon.name,
                      price: addon.price,
                      quantity: sel.qty,
                      answer: sel.answer
                  });
              }
          });

          const newRegId = `reg-${Date.now()}`;
          const refCode = searchParams.get('ref') || sessionStorage.getItem(`active_ref_${event.id}`);

          const newReg: Registration = {
              id: newRegId, 
              eventId: event.id, 
              attendeeName: regData.name, 
              attendeeEmail: regData.email.trim(),
              phoneNumber: regData.phoneNumber,
              donationAmount: Number(regData.donation) || 0, 
              platformDonationAmount: regData.platformDonationAmount,
              serviceFee: 0, 
              taxAmount: 0, 
              customFeesAmount: 0,
              answers: regData.answers,
              tickets: groupedTickets, 
              addOns: purchasedAddOns, 
              timestamp: Date.now(), 
              paymentStatus: event.paymentConfig.method === 'online' ? 'pending' : 'offline_pending', 
              approvalStatus: event.requiresApproval ? 'pending' : 'approved',
              promoCodeUsed: appliedPromo?.code,
              affiliateCode: refCode || undefined, 
              discountAmount: 0, 
              waiverAgreed: regData.waiverAgreed
          };
          
          const savePromise = StorageService.saveRegistration(newReg);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Registration timed out")), 10000));
          
          const result: any = await Promise.race([savePromise, timeoutPromise]);
          
          setNewCredentials(result.newAccount); 
          setCompletedRegistration(newReg);
          setIsSuccess(true);
          
          if (refCode) {
              StorageService.trackAffiliateConversion(event.id, refCode);
          }

          window.scrollTo(0, 0);
      } catch (e: any) {
          console.error("Registration Error", e);
          alert("Error processing registration: " + (e.message || "Unknown error"));
      } finally {
          setIsRegistering(false);
      }
  };

  const getTotalTickets = () => {
      return (Object.values(ticketSelection) as number[]).reduce((a, b) => a + b, 0);
  };

  return (
    <div className="min-h-screen pb-20">
        <div className="h-64 md:h-96 relative overflow-hidden">
            <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-4 md:p-8 max-w-4xl">
                <Badge className="mb-4 bg-primary text-white border-none">{event.category || 'Event'}</Badge>
                <h1 className="text-4xl md:text-6xl font-black font-display text-zinc-900 dark:text-white uppercase leading-none mb-4 shadow-black drop-shadow-lg">{event.title}</h1>
                <div className="flex flex-wrap gap-4 text-zinc-700 dark:text-zinc-300 font-bold">
                    <div className="flex items-center gap-2"><Calendar size={20} className="text-primary"/> {new Date(event.date).toLocaleDateString()}</div>
                    <div className="flex items-center gap-2"><Clock size={20} className="text-primary"/> {formatTime(event.time, event.timeFormat)}</div>
                    <div className="flex items-center gap-2"><MapPin size={20} className="text-primary"/> {event.location}</div>
                </div>
            </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
                <Card className="p-6">
                    <h2 className="text-xl font-bold mb-4">About Event</h2>
                    <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: event.description }} />
                </Card>

                {!isSuccess ? (
                    <Card className="p-6">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Ticket className="text-primary"/> Select Tickets</h2>
                        
                        {event.priceType === 'tiered' ? (
                            <div className="space-y-4">
                                {event.ticketTiers?.map(tier => (
                                    <div key={tier.id} className="flex justify-between items-center p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                                        <div>
                                            <div className="font-bold">{tier.name}</div>
                                            <div className="text-sm text-zinc-500">${tier.price}</div>
                                            {tier.description && <div className="text-xs text-zinc-400 mt-1">{tier.description}</div>}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => handleTicketChange(tier.id, Math.max(0, (ticketSelection[tier.id]||0) - 1))} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">-</button>
                                            <span className="w-4 text-center font-bold">{ticketSelection[tier.id] || 0}</span>
                                            <button onClick={() => handleTicketChange(tier.id, (ticketSelection[tier.id]||0) + 1)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl flex justify-between items-center">
                                <div>
                                    <div className="font-bold">{event.ticketName || 'General Admission'}</div>
                                    <div className="text-sm text-zinc-500">{event.priceType === 'free' ? 'Free' : event.priceType === 'donation' ? 'Donation' : `$${event.price}`}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => handleTicketChange('general', Math.max(0, (ticketSelection['general']||0) - 1))} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">-</button>
                                    <span className="w-4 text-center font-bold">{ticketSelection['general'] || 0}</span>
                                    <button onClick={() => handleTicketChange('general', (ticketSelection['general']||0) + 1)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">+</button>
                                </div>
                            </div>
                        )}

                        <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                            <div className="text-xs font-bold text-zinc-500 uppercase mb-2">Promo Code</div>
                            <div className="flex gap-2">
                                <Input 
                                    value={promoCode} 
                                    onChange={e => setPromoCode(e.target.value.toUpperCase())} 
                                    placeholder="ENTER CODE" 
                                    containerClassName="mb-0 flex-1"
                                    disabled={!!appliedPromo}
                                />
                                {appliedPromo ? (
                                    <Button variant="danger" onClick={() => {setAppliedPromo(null); setPromoCode('');}}>Remove</Button>
                                ) : (
                                    <Button variant="outline" onClick={handleApplyPromo}>Apply</Button>
                                )}
                            </div>
                            {appliedPromo && (
                                <div className="mt-2 text-sm text-green-600 font-bold flex items-center gap-1">
                                    <Check size={14}/> Code Applied: {appliedPromo.type === 'percent' ? `${appliedPromo.value}% OFF` : `-$${appliedPromo.value}`}
                                </div>
                            )}
                        </div>

                        {getTotalTickets() > 1 && (
                            <div className="mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800 animate-in fade-in">
                                <h3 className="font-bold mb-4 flex items-center gap-2"><Users size={18} className="text-secondary"/> Guest Details</h3>
                                <div className="space-y-4">
                                    {(event.ticketTiers || [{id: 'general', name: 'General Admission'}]).map(tier => {
                                        const qty = ticketSelection[tier.id] || 0;
                                        if (qty === 0) return null;
                                        
                                        return Array.from({length: qty}).map((_, idx) => (
                                            <div key={`${tier.id}-${idx}`} className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                                <div className="text-xs font-bold text-zinc-500 uppercase mb-2">
                                                    {tier.name} - Guest #{idx + 1}
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <Input 
                                                        placeholder="Guest Name" 
                                                        value={assignments[tier.id]?.[idx]?.name || ''} 
                                                        onChange={e => handleAssignmentChange(tier.id, idx, 'name', e.target.value)} 
                                                        containerClassName="mb-0"
                                                    />
                                                    <Input 
                                                        placeholder="Guest Email (Optional)" 
                                                        value={assignments[tier.id]?.[idx]?.email || ''} 
                                                        onChange={e => handleAssignmentChange(tier.id, idx, 'email', e.target.value)} 
                                                        containerClassName="mb-0"
                                                    />
                                                </div>
                                            </div>
                                        ));
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800">
                            <h3 className="font-bold mb-4">Your Details (Main Buyer)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Name" value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} required />
                                <Input label="Email" type="email" value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} required />
                                <Input label="Phone (Optional)" type="tel" value={regData.phoneNumber} onChange={e => setRegData({...regData, phoneNumber: e.target.value})} />
                            </div>
                            
                            {event.questions?.map(q => (
                                <div key={q.id} className="mt-4">
                                    <label className="block text-sm font-bold mb-2">{q.label} {q.required && '*'}</label>
                                    {q.type === 'text' && <Input value={regData.answers[q.id] || ''} onChange={e => setRegData({...regData, answers: {...regData.answers, [q.id]: e.target.value}})} required={q.required} containerClassName="mb-0"/>}
                                    {q.type === 'select' && (
                                        <Select 
                                            value={regData.answers[q.id] || ''} 
                                            onChange={e => setRegData({...regData, answers: {...regData.answers, [q.id]: e.target.value}})}
                                            options={q.options?.map(o => ({value: o, label: o})) || []}
                                            required={q.required}
                                            containerClassName="mb-0"
                                        />
                                    )}
                                </div>
                            ))}

                            <div className="mt-6">
                                <Button onClick={handleRegister} isLoading={isRegistering} className="w-full py-4 text-lg font-bold shadow-xl shadow-primary/20">
                                    Complete Registration
                                </Button>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <Card className="p-8 text-center border-green-500/50 bg-green-500/5">
                        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-lg shadow-green-500/40">
                            <Check size={40} strokeWidth={4} />
                        </div>
                        <h2 className="text-3xl font-black text-green-600 dark:text-green-400 mb-2">You're In!</h2>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                            Your registration for <span className="font-bold text-zinc-900 dark:text-white">{event.title}</span> is confirmed.
                        </p>
                        {newCredentials && (
                            <div className="bg-white dark:bg-black p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mb-6 text-left max-w-sm mx-auto">
                                <div className="text-xs font-bold uppercase text-primary mb-2 flex items-center gap-1"><Lock size={12}/> Account Created</div>
                                <p className="text-sm mb-1">Use these details to log in and view your ticket:</p>
                                <div className="font-mono text-sm bg-zinc-100 dark:bg-zinc-900 p-2 rounded">
                                    Email: {newCredentials.email}<br/>
                                    Password: {newCredentials.password}
                                </div>
                            </div>
                        )}
                        <div className="flex gap-2 justify-center">
                            <Button onClick={() => setShowReceipt(true)} variant="outline">
                                <Printer size={16} className="mr-2"/> View Receipt
                            </Button>
                            <Button onClick={() => navigate('/my-tickets')}>View My Tickets</Button>
                        </div>
                        {completedRegistration && (
                            <ReceiptModal 
                                isOpen={showReceipt} 
                                onClose={() => setShowReceipt(false)} 
                                registration={completedRegistration} 
                                event={event} 
                                organizer={organizerUser} 
                            />
                        )}
                    </Card>
                )}
            </div>

            <div className="space-y-6">
                <Card className="p-6">
                    <h3 className="font-bold mb-4">Organizer</h3>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center font-bold">
                            {event.organizer.charAt(0)}
                        </div>
                        <div>
                            <div className="font-bold">{event.organizer}</div>
                            <a href={`mailto:${event.organizerEmail}`} className="text-xs text-primary hover:underline">Contact</a>
                        </div>
                    </div>
                </Card>
                
                <Card className="p-6">
                    <h3 className="font-bold mb-4">Share</h3>
                    <Button variant="outline" className="w-full mb-2" onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        alert("Link copied!");
                    }}>
                        <Share2 size={16} className="mr-2"/> Copy Link
                    </Button>
                </Card>
            </div>
        </div>
    );
};
