import React, { useState } from 'react';

interface FormField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  options?: string[];
}

interface ClientFormProps {
  title: string;
  fields: FormField[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const ADD_CLIENT_STEPS: FormField[] = [
  { name: 'clientType', type: 'inline-buttons', label: 'Client Type', options: ['Billable', 'Internal', 'Pro Bono'], required: true },
  { name: 'clientName', type: 'text', label: 'Client Name', required: true },
  { name: 'sow', type: 'select', label: 'SOW', options: ['Retainer', 'Project', 'Variable'], required: true },
  { name: 'sowLink', type: 'url', label: 'SOW Link', required: true },
  { name: 'hourlyRate', type: 'number', label: 'Hourly Rate', required: true },
  { name: 'months', type: 'month-multi', label: 'Select Months', required: true },
  { name: 'budgetHours', type: 'budget-hours-multi', label: 'Budget Hours per Month', required: true }
];

export function ClientForm({ title, fields: initialFields, onSubmit, onCancel }: ClientFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [currentStep, setCurrentStep] = useState(0);
  
  // States for custom multi-month step
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [monthInput, setMonthInput] = useState('');
  const [budgetHours, setBudgetHours] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Override fields for "Add Client" to use our custom multi-month logic
  const isAddClient = title.toLowerCase().includes("add client");
  const fields = isAddClient ? ADD_CLIENT_STEPS : initialFields;

  const handleNext = () => {
    if (currentStep < fields.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      submitForm();
    }
  };

  const submitForm = async () => {
    setIsSubmitting(true);
    let finalData = { ...formData };
    
    if (isAddClient) {
      finalData.months = selectedMonths;
      finalData.budgetHours = budgetHours;
    }
    
    await onSubmit(finalData);
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  const handleInlineSelect = (fieldName: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    // Small delay for visual feedback before auto-advancing
    setTimeout(() => {
      handleNext();
    }, 300);
  };

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

  if (!fields || fields.length === 0 || isSubmitted) return null;

  const field = fields[currentStep];
  const isLastStep = currentStep === fields.length - 1;

  // Validate current step
  let canProceed = false;
  if (!field.required) {
    canProceed = true;
  } else if (field.type === 'month-multi') {
    canProceed = selectedMonths.length > 0;
  } else if (field.type === 'budget-hours-multi') {
    canProceed = selectedMonths.length > 0 && selectedMonths.every(m => budgetHours[m] && budgetHours[m].trim() !== '');
  } else {
    canProceed = !!formData[field.name];
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 my-4 max-w-lg w-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-foreground">{title}</h3>
        <div className="text-sm font-medium text-muted-foreground">
          Step {currentStep + 1} of {fields.length}
        </div>
      </div>
      
      <div className="space-y-6">
        <div>
          <label className="block text-base font-medium text-foreground mb-3">{field.label}</label>
          
          {field.type === 'inline-buttons' ? (
            <div className="flex flex-wrap gap-3">
              {field.options?.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleInlineSelect(field.name, opt)}
                  className={`px-5 py-3 rounded-xl font-medium transition-all ${
                    formData[field.name] === opt 
                      ? 'bg-primary text-foreground shadow-lg shadow-blue-500/30' 
                      : 'bg-hover-bg hover:bg-gray-600 text-foreground border border-border'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : field.type === 'select' ? (
             <select
                className="w-full bg-input border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData[field.name] || ''}
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
             >
                <option value="" disabled>Select {field.label}</option>
                {field.options?.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
             </select>
          ) : field.type === 'month-multi' ? (
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
          ) : field.type === 'budget-hours-multi' ? (
            <div className="space-y-3">
              {selectedMonths.map(m => (
                <div key={m} className="flex items-center gap-3 bg-input/50 p-3 rounded-xl border border-border">
                  <span className="text-sm text-foreground font-medium w-32 truncate">{m.replace('_', ' ')}</span>
                  <input required type="number" step="any" placeholder="Hours"
                         className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                         value={budgetHours[m] || ''} onChange={e => setBudgetHours({...budgetHours, [m]: e.target.value})} 
                         onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (canProceed) handleNext();
                            }
                         }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <input
              type={field.type}
              step={field.type === 'number' ? 'any' : undefined}
              className="w-full bg-input border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData[field.name] || ''}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (canProceed) handleNext();
                }
              }}
              autoFocus
            />
          )}
        </div>
        
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
          
          {field.type !== 'inline-buttons' && (
            <button 
              type="button"
              onClick={handleNext}
              disabled={!canProceed || isSubmitting}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] hover:from-[#45bbb3] hover:to-[#3a9a7d] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : isLastStep ? 'Submit' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
