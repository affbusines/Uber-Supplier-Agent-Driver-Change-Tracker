import { useState, useEffect } from 'react';
import { Sparkles, Copy, Check, Info, RefreshCw, PenTool } from 'lucide-react';

export default function SandboxSimulator() {
  const [drivers, setDrivers] = useState([
    {
      uuid: 'e0d56434-9cab-4c6c-b932-ad1d44ba1d4f',
      name: 'MD. MEHEDI HASAN',
      avatarSeed: 'Mehedi',
      phone: '+880 1624618097',
      email: '01624618097ar@gmail.com',
      trips: 234
    },
    {
      uuid: '2cf03e6a-7585-468c-92ce-d71c3fd18b71',
      name: 'RAKIBUL HASAN',
      avatarSeed: 'Rakib',
      phone: '+880 1712345678',
      email: 'rakib.hasan@gmail.com',
      trips: 89
    },
    {
      uuid: '3df04e2a-8485-47cc-93ce-d81c3fd19b72',
      name: 'SHAFIQUL ISLAM',
      avatarSeed: 'Shafiq',
      phone: '+880 1812345679',
      email: 'shafiq@gmail.com',
      trips: 153
    },
    {
      uuid: '4ef05e1a-9485-48cc-94ce-d91c3fd20b73',
      name: 'TANVIR AHMED',
      avatarSeed: 'Tanvir',
      phone: '+880 1912345680',
      email: 'tanvir@gmail.com',
      trips: 412
    }
  ]);

  // Synchronize Sandbox Portal State with Backend to support realistic Live Auto Sync responses
  useEffect(() => {
    fetch('/api/sandbox/portal-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drivers })
    }).catch(err => console.error('Error updating backend portal state:', err));
  }, [drivers]);

  const [copied, setCopied] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ phone: '', email: '', trips: 0 });

  // Generate Outer HTML which matches exactly what DOMParser expects
  const generateOuterHTML = () => {
    let html = `<div class="uber-table-mock-container" role="rowgroup">\n`;
    drivers.forEach(d => {
      html += `  <!-- Driver Row for ${d.name} -->\n`;
      html += `  <div role="row" class="drivers-table-row" data-testid="drivers-table-row" data-tracking-payload='{"driverUUID": "${d.uuid}"}'>\n`;
      html += `    <div class="avatar px-3" data-baseweb="avatar">\n`;
      html += `      <img class="img-circle" src="https://api.dicebear.com/7.x/avataaars/svg?seed=${d.avatarSeed}" alt="${d.name}" />\n`;
      html += `    </div>\n`;
      html += `    <div class="name-cell">${d.name}</div>\n`;
      html += `    <div role="gridcell" class="contact-cell">\n`;
      html += `      <div class="_css-laRbCo">${d.phone}</div>\n`;
      html += `      <div class="_css-fRzRxF">${d.email}</div>\n`;
      html += `    </div>\n`;
      html += `    <div role="gridcell" class="tips-cell" data-tracking-name="driver-trip-count">${d.trips}</div>\n`;
      html += `  </div>\n\n`;
    });
    html += `</div>`;
    return html;
  };

  const currentGeneratedHtml = generateOuterHTML();

  const handleCopy = () => {
    navigator.clipboard.writeText(currentGeneratedHtml);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const handleEditClick = (idx: number) => {
    setEditingIndex(idx);
    setEditForm({
      phone: drivers[idx].phone,
      email: drivers[idx].email,
      trips: drivers[idx].trips
    });
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const updated = [...drivers];
    updated[editingIndex] = {
      ...updated[editingIndex],
      phone: editForm.phone,
      email: editForm.email,
      trips: Number(editForm.trips)
    };
    setDrivers(updated);
    setEditingIndex(null);
  };

  const simulateTripIncreasees = () => {
    setDrivers(prev => prev.map(d => ({
      ...d,
      trips: d.trips + Math.floor(Math.random() * 8) + 1
    })));
  };

  const handleRandomizeContacts = () => {
    const phoneSuffixes = ['99', '88', '77', '11'];
    const emailPrefixes = ['hasan.', 'rakib_mod.', 'shafiq_office.', 'tanvir.ahmed.new.'];
    setDrivers(prev => prev.map((d, i) => {
      if (i % 2 === 0) {
        // Change both phone and email
        return {
          ...d,
          phone: d.phone.slice(0, -2) + phoneSuffixes[i],
          email: emailPrefixes[i] + d.email,
          trips: d.trips + 12
        };
      }
      return d;
    }));
  };

  return (
    <div id="sandbox-integration-view" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* 1. MOCK INTERACTIVE UBER SUPPLIER PORTAL WINDOW */}
      <div className="lg:col-span-12 xl:col-span-7 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex flex-col shadow-lg">
        
        {/* Portal Header */}
        <div className="bg-black px-4 py-3 border-b border-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
          </div>
          <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest select-none">
            MOCK UBER PARTNER WEBSITE
          </span>
          <div className="w-12"></div>
        </div>

        {/* Address bar URL bar */}
        <div className="bg-zinc-900/40 p-2 border-b border-zinc-900 flex items-center gap-2">
          <div className="bg-zinc-950 border border-zinc-800 text-zinc-400 font-mono text-[10.5px] rounded px-3 py-1 flex-1 flex items-center gap-2">
            <span className="text-emerald-500 select-none">🔐</span>
            <span>https://supplier.uber.com/orgs/689c1d-bd22/drivers</span>
          </div>
          <button 
            onClick={simulateTripIncreasees}
            className="p-1 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition flex items-center gap-1.5 cursor-pointer"
            title="Increase trips for all"
          >
            <RefreshCw size={11} />
            <span>Inc Trips</span>
          </button>
        </div>

        {/* Body Sandbox Screen */}
        <div className="p-6 text-white space-y-4 flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold font-sans tracking-tight">Drivers List</h3>
              <p className="text-zinc-500 text-[11px]">Active drivers linked with your enterprise supplier credentials.</p>
            </div>
            
            <button
              onClick={handleRandomizeContacts}
              className="text-[11px] font-bold uppercase tracking-wider bg-emerald-500 text-black px-3 py-1.5 rounded hover:bg-emerald-400 transition cursor-pointer"
            >
              Simulate Updates (Changes)
            </button>
          </div>

          {/* Table Container */}
          <div className="border border-zinc-800 rounded overflow-hidden divide-y divide-zinc-900 bg-zinc-900/20">
            {drivers.map((drv, idx) => (
              <div 
                key={drv.uuid}
                className="flex items-center justify-between p-3 sm:p-4 hover:bg-zinc-900/40 transition gap-4"
              >
                <div className="flex items-center gap-3">
                  <img 
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${drv.avatarSeed}`}
                    alt={drv.name}
                    className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700"
                  />
                  <div>
                    <span className="block font-semibold text-xs text-zinc-100">{drv.name}</span>
                    <span className="block text-[10px] text-zinc-500 font-mono leading-none mt-0.5">{drv.uuid.slice(0, 8)}...</span>
                  </div>
                </div>

                <div className="flex-1 max-w-[180px] text-xs">
                  <span className="block text-zinc-300 font-medium">{drv.phone}</span>
                  <span className="block text-zinc-500 text-[10.5px] whitespace-normal tracking-tight">{drv.email}</span>
                </div>

                <div className="text-right text-xs">
                  <span className="block font-mono text-zinc-100 font-bold">{drv.trips}</span>
                  <span className="block text-[10px] text-zinc-500 uppercase font-semibold">Trips</span>
                </div>

                <button
                  onClick={() => handleEditClick(idx)}
                  className="p-1 px-2.5 bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-400 rounded transition text-[11px] cursor-pointer"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>

          {/* Form Editor Modal/Overlay when active */}
          {editingIndex !== null && (
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg space-y-3">
              <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <PenTool size={12} className="text-emerald-400" />
                <span>Quick Update: {drivers[editingIndex].name}</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase font-semibold mb-1">Email</label>
                  <input 
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-zinc-100 outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase font-semibold mb-1">Phone</label>
                  <input 
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-zinc-100 outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase font-semibold mb-1">Total Trips</label>
                  <input 
                    type="number"
                    value={editForm.trips}
                    onChange={(e) => setEditForm(prev => ({ ...prev, trips: Number(e.target.value) }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-zinc-100 outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1.5 justify-end">
                <button 
                  onClick={() => setEditingIndex(null)}
                  className="px-3 py-1 bg-zinc-800 text-zinc-400 font-semibold text-xs rounded hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEdit}
                  className="px-3 py-1 bg-emerald-500 text-black font-bold text-xs rounded hover:bg-emerald-400 transition cursor-pointer"
                >
                  Apply Change
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. LIVE GENERATED RAW CODE PREVIEW */}
      <div className="lg:col-span-12 xl:col-span-5 flex flex-col space-y-6">
        <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4 shadow-sm flex-1 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-zinc-800 font-bold text-sm flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-500" />
              <span>Copy Simulated Row HTML</span>
            </h3>
            <p className="text-zinc-600 text-xs leading-relaxed">
              স্যান্ডবক্সে আপনার করা পরিবর্তনগুলো নিচের এডিটরটিতে রিয়েল-টাইমে রেন্ডার হচ্ছে। বাটনটি ক্লিক করে HTML কপি করে নিন এবং <strong>Import Tab</strong> এ গিয়ে পেস্ট করে ডেটাবেস ট্র্যাক সিমুলেট করুন!
            </p>

            <div className="relative bg-zinc-900 border border-zinc-800 p-4 rounded overflow-auto h-72 text-zinc-100">
              <pre className="font-mono text-[10px] leading-relaxed text-emerald-400 whitespace-pre">{currentGeneratedHtml}</pre>
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-4 border-t border-zinc-100">
            <button
              onClick={handleCopy}
              className="w-full py-2.5 px-4 bg-black hover:bg-zinc-800 text-white font-bold text-xs rounded transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-400 animate-scale-in" />
                  <span className="text-emerald-400">Copied! Ready to Paste</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Uber Row OuterHTML Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info callout */}
        <div className="bg-amber-50 border border-amber-200 text-amber-950 p-4 rounded-lg flex gap-3 text-xs leading-relaxed">
          <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5">How Change Tracking Operates:</span>
            যদি কোনো ড্রাইভারের পূর্ববর্তী ইমেইল বা ফোন নম্বরের সাথে নতুন এক্সট্র্যাক্ট করা ডাটার কোনো বেমানান অমিল পাওয়া যায়, সিস্টেম স্বয়ংক্রিয়ভাবে তার 
            <code>old_email</code> অথবা <code>old_phone</code> প্যারামিটার হিস্ট্রি ডক হিসেবে স্টোর করে ফেলবে।
          </div>
        </div>
      </div>

    </div>
  );
}
