import React, { useState } from 'react';

export function RevenueDatePicker({ type, timeRange, team, onSubmit, onCancel }: any) {
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [monthInput, setMonthInput] = useState('');
  const [yearInput, setYearInput] = useState(new Date().getFullYear().toString());

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

  const handleSubmit = () => {
    if (timeRange === 'specific_months') {
      if (selectedMonths.length === 0) return;
      const sheet = type === 'client' ? 'Clients_Sheet' : 'Services Lookup Sheet';
      const target = type === 'client' ? 'client' : `team ${team}`;
      const msg = `Generate revenue for the following months: ${selectedMonths.join(", ")} by ${target} from ${sheet}.`;
      onSubmit(msg);
    } else {
      if (!yearInput) return;
      const sheet = type === 'client' ? 'Clients_Sheet' : 'Services Lookup Sheet';
      const target = type === 'client' ? 'client' : `team ${team}`;
      const msg = `Generate revenue for the year ${yearInput} by ${target} from ${sheet}.`;
      onSubmit(msg);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 my-4 max-w-sm w-full shadow-sm">
      <h3 className="text-lg font-bold text-foreground mb-4">
        Select {timeRange === 'specific_months' ? 'Months' : 'Year'}
      </h3>

      {timeRange === 'specific_months' ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="month" className="flex-1 bg-input border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                   value={monthInput} onChange={e => setMonthInput(e.target.value)} />
            <button type="button" onClick={handleAddMonth} className="px-4 py-2 bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] text-white rounded-xl font-medium">Add</button>
          </div>
          {selectedMonths.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedMonths.map(m => (
                <div key={m} className="bg-hover-bg text-foreground px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                  {m.replace('_', ' ')}
                  <button type="button" onClick={() => setSelectedMonths(selectedMonths.filter(x => x !== m))} className="text-muted-foreground hover:text-foreground">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <input type="number" min="2000" max="2100" className="w-full bg-input border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                 value={yearInput} onChange={e => setYearInput(e.target.value)} placeholder="e.g. 2026" />
        </div>
      )}

      <div className="flex justify-between items-center mt-6 pt-4 border-t border-border">
        <button type="button" onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
        <button 
          type="button" 
          onClick={handleSubmit}
          disabled={timeRange === 'specific_months' ? selectedMonths.length === 0 : !yearInput}
          className="px-4 py-2 bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] text-white text-sm font-semibold rounded-lg disabled:opacity-50"
        >
          Generate
        </button>
      </div>
    </div>
  );
}
