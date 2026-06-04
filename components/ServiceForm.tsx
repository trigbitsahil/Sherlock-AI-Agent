import React, { useState, useEffect, useMemo } from 'react';

const groupToTeams: Record<string, string[]> = {
"Brazil": ["BR AMA",
"BR MAU",
"BR DAN",
"BR FAB",
"CSR FAB",
"BR MIG",
],  "LATAM": ["ARG/URU", "ANDEAN", "CHILE", "CAM/CAR"],
  "Mexico": ["MEXICO"],
  "Digital": ["EVENTS", "DIG-SM", "DIG-SEO", "DIG-PM/INBOUND", "DIG-INF"],
  "Design": ["DESIGN"]
};


const SERVICE_STEPS = [
  { id: 'months', label: 'Select Months' },
  { id: 'clientType', label: 'Client Type' },
  { id: 'clientName', label: 'Select Client' },
  { id: 'accountLead', label: 'Account Lead (Optional)' },
  { id: 'teams', label: 'Select Teams' },
  { id: 'allocations', label: 'Hours Allocation' }
];

export function ServiceForm({ onSubmit, onCancel }: any) {
  const [currentStep, setCurrentStep] = useState(0);

  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [monthInput, setMonthInput] = useState('');
  
  const [clientType, setClientType] = useState('Billable');
  const [clientName, setClientName] = useState('');
  const [accountLead, setAccountLead] = useState('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  
  // Structure: { [month]: { [team]: string(hours) } }
  const [teamHours, setTeamHours] = useState<Record<string, Record<string, string>>>({});
  
  const [availableClients, setAvailableClients] = useState<Record<string, Record<string, { budgetHours: number, hourlyRate: number }>>>({});
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Fetch clients whenever months or clientType change
  useEffect(() => {
    if (selectedMonths.length === 0) {
      setAvailableClients({});
      setClientName('');
      return;
    }
    
    setIsLoadingClients(true);
    fetch('/api/services/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ months: selectedMonths, clientType })
    })
    .then(res => res.json())
    .then(data => {
      setAvailableClients(data.clients || {});
      const clientsList = Object.keys(data.clients || {});
      if (clientsList.length > 0 && !clientsList.includes(clientName)) {
        setClientName(clientsList[0]);
      } else if (clientsList.length === 0) {
        setClientName('');
      }
      setIsLoadingClients(false);
    })
    .catch(() => {
      setAvailableClients({});
      setClientName('');
      setIsLoadingClients(false);
    });
  }, [selectedMonths, clientType]);

  const handleAddMonth = () => {
    if (monthInput) {
      const [year, monthNum] = monthInput.split('-');
      const date = new Date(parseInt(year), parseInt(monthNum) - 1);
      const monthName = date.toLocaleString('default', { month: 'long' });
      const formatted = `${monthName}_${year}`;
      if (!selectedMonths.includes(formatted)) {
        setSelectedMonths([...selectedMonths, formatted]);
      }
      setMonthInput('');
    }
  };

  const toggleTeam = (team: string) => {
    if (selectedTeams.includes(team)) {
      setSelectedTeams(selectedTeams.filter(t => t !== team));
    } else {
      setSelectedTeams([...selectedTeams, team]);
    }
  };

  const handleHoursChange = (month: string, team: string, value: string) => {
    setTeamHours(prev => ({
      ...prev,
      [month]: {
        ...(prev[month] || {}),
        [team]: value
      }
    }));
  };

  const handleInlineTypeSelect = (opt: string) => {
    setClientType(opt);
    setTimeout(() => {
      setCurrentStep(prev => prev + 1);
    }, 300);
  };

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!clientName || !availableClients[clientName]) return errors;

    for (const month of selectedMonths) {
      const budgetForMonth = availableClients[clientName][month]?.budgetHours || 0;
      let totalAllocated = 0;
      for (const team of selectedTeams) {
        const h = parseFloat(teamHours[month]?.[team] as string) || 0;
        totalAllocated += h;
      }
      if (totalAllocated > budgetForMonth) {
        errors[month] = `Total allocated (${totalAllocated}) exceeds budget (${budgetForMonth})!`;
      }
    }
    return errors;
  }, [selectedMonths, clientName, selectedTeams, teamHours, availableClients]);

  const step = SERVICE_STEPS[currentStep];

  let canProceed = false;
  if (step.id === 'months') {
    canProceed = selectedMonths.length > 0;
  } else if (step.id === 'clientType') {
    canProceed = true;
  } else if (step.id === 'clientName') {
    canProceed = !!clientName && Object.keys(availableClients).length > 0;
  } else if (step.id === 'accountLead') {
    canProceed = true; // Optional
  } else if (step.id === 'teams') {
    canProceed = selectedTeams.length > 0;
  } else if (step.id === 'allocations') {
    canProceed = Object.keys(validationErrors).length === 0;
  }

  const handleNext = () => {
    if (canProceed && currentStep < SERVICE_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else if (currentStep === SERVICE_STEPS.length - 1) {
      submitForm();
    }
  };

  const submitForm = async () => {
    if (!canProceed) return;
    setIsSubmitting(true);
    
    const hourlyRates: Record<string, number> = {};
    for (const month of selectedMonths) {
      hourlyRates[month] = availableClients[clientName][month]?.hourlyRate || 0;
    }

    const payload = {
      months: selectedMonths,
      clientType,
      clientName,
      accountLead,
      teamHours,
      hourlyRates
    };

    try {
      const res = await fetch("/api/services/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      onSubmit(result, payload);
    } catch (e: any) {
      onSubmit({ error: e.message || "Network error" }, null);
    } finally {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }
  };

  if (isSubmitted) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-6 my-4 max-w-lg w-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-foreground">Add Service</h3>
        <div className="text-sm font-medium text-muted-foreground">
          Step {currentStep + 1} of {SERVICE_STEPS.length}
        </div>
      </div>
      
      <div className="space-y-6">
        <label className="block text-base font-medium text-foreground mb-3">{step.label}</label>

        {step.id === 'months' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input type="month" className="flex-1 bg-input border border-border rounded-xl px-4 py-3 text-foreground [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-blue-500"
                     value={monthInput} onChange={e => setMonthInput(e.target.value)} />
              <button type="button" onClick={handleAddMonth} className="px-6 py-2 bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] hover:from-[#45bbb3] hover:to-[#3a9a7d] text-white rounded-xl font-medium transition-colors">Add</button>
            </div>
            {selectedMonths.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {selectedMonths.map(m => (
                  <div key={m} className="bg-hover-bg text-foreground px-3 py-1.5 rounded-lg text-sm flex items-center gap-2">
                    {m.replace('_', ' ')}
                    <button type="button" onClick={() => setSelectedMonths(selectedMonths.filter(x => x !== m))} className="text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step.id === 'clientType' && (
          <div className="flex flex-wrap gap-3">
            {['Billable', 'Internal', 'Pro Bono'].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => handleInlineTypeSelect(opt)}
                className={`px-5 py-3 rounded-xl font-medium transition-all flex-1 ${
                  clientType === opt 
                    ? 'bg-primary text-foreground shadow-lg shadow-blue-500/30' 
                    : 'bg-hover-bg hover:bg-gray-600 text-foreground border border-border'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {step.id === 'clientName' && (
          <div>
            {isLoadingClients ? (
              <div className="flex items-center gap-2 text-blue-400 italic px-2 py-4">
                <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                Finding common clients...
              </div>
            ) : Object.keys(availableClients).length === 0 ? (
              <div className="text-red-400 bg-red-900/20 p-4 rounded-xl border border-red-800/50">
                No common clients found across all selected months for {clientType}.
              </div>
            ) : (
              <select className="w-full bg-input border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={clientName} onChange={e => setClientName(e.target.value)}>
                {Object.keys(availableClients).map(client => (
                  <option key={client} value={client}>{client}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {step.id === 'accountLead' && (
          <input type="text" placeholder="e.g. John Doe" className="w-full bg-input border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" 
                 value={accountLead} onChange={e => setAccountLead(e.target.value)} 
                 onKeyDown={e => { if (e.key === 'Enter') handleNext(); }} autoFocus />
        )}

        {step.id === 'teams' && (
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            {Object.entries(groupToTeams).map(([group, teams]) => (
              <div key={group} className="bg-input/50 p-3 rounded-xl border border-border">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{group}</div>
                <div className="flex flex-wrap gap-2">
                  {teams.map(team => (
                    <label key={team} className={`flex items-center gap-2 border px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${selectedTeams.includes(team) ? 'bg-blue-900/30 border-blue-500' : 'bg-card border-border hover:bg-hover-bg'}`}>
                      <input type="checkbox" checked={selectedTeams.includes(team)} onChange={() => toggleTeam(team)} className="rounded bg-input border-border text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800" />
                      <span className="text-sm text-foreground">{team}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {step.id === 'allocations' && (
          <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            {selectedMonths.map(month => {
              const budget = availableClients[clientName]?.[month]?.budgetHours || 0;
              let allocated = 0;
              selectedTeams.forEach(t => allocated += parseFloat(teamHours[month]?.[t] as string) || 0);
              const isOverBudget = allocated > budget;

              return (
                <div key={month} className={`p-4 rounded-xl border ${isOverBudget ? 'bg-red-900/20 border-red-800/50' : 'bg-input/50 border-border'}`}>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-foreground text-sm">{month.replace('_', ' ')}</h4>
                    <div className="text-xs font-medium bg-card px-2 py-1 rounded-md">
                      Budget: <span className="text-blue-400">{budget}</span> | 
                      Allocated: <span className={isOverBudget ? "text-red-400 font-bold" : "text-green-400"}> {allocated}</span>
                    </div>
                  </div>
                  {isOverBudget && (
                    <div className="text-xs text-red-400 mb-3">{validationErrors[month]}</div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {selectedTeams.map(team => (
                      <div key={team} className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">{team}</label>
                        <input type="number" step="any" placeholder="0"
                               className={`w-full bg-card border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 ${isOverBudget ? 'border-red-500/50 focus:ring-red-500/50' : 'border-border focus:ring-blue-500/50'}`}
                               value={teamHours[month]?.[team] || ''} onChange={e => handleHoursChange(month, team, e.target.value)} 
                               onKeyDown={e => { if (e.key === 'Enter' && canProceed) handleNext(); }}/>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-between items-center pt-4 mt-6 border-t border-border">
          <button 
            type="button" 
            onClick={() => {
              if (currentStep === 0) {
                setIsSubmitted(true);
                onCancel();
              } else {
                setCurrentStep(currentStep - 1);
              }
            }} 
            className="px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-hover-bg font-medium transition-colors"
          >
            {currentStep === 0 ? 'Cancel' : '← Back'}
          </button>
          
          {step.id !== 'clientType' && (
            <button 
              type="button"
              onClick={handleNext}
              disabled={!canProceed || isSubmitting}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] hover:from-[#45bbb3] hover:to-[#3a9a7d] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : currentStep === SERVICE_STEPS.length - 1 ? 'Submit Allocation' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
