import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Phone, SignalHigh } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/app/ussd")({
  component: USSDSimulator,
});

function USSDSimulator() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useT();
  
  const [input, setInput] = useState("");
  const [menu, setMenu] = useState<"dialer" | "main" | "status" | "book">("dialer");
  const [ussdText, setUssdText] = useState("");

  const handleDial = () => {
    if (input === "*123#") {
      setMenu("main");
      setUssdText("Welcome to Rapide Offline Mode\n1. Check Order Status\n2. Request Rider\n3. My Wallet Balance\n\nReply with number:");
      setInput("");
    } else {
      setUssdText("Unknown MMI code.");
      setMenu("dialer");
      setTimeout(() => setMenu("dialer"), 2000);
    }
  };

  const handleReply = () => {
    if (menu === "main") {
      if (input === "1") {
        setMenu("status");
        setUssdText("Your last order R-9382 is out for delivery. Rider is 5 mins away.\n0. Back");
      } else if (input === "2") {
        setMenu("book");
        setUssdText("Enter pickup address or landmark:");
      } else if (input === "3") {
        setUssdText(`Your balance is 15,000 XOF.\n0. Back`);
      }
    } else if (input === "0") {
      setMenu("main");
      setUssdText("Welcome to Rapide Offline Mode\n1. Check Order Status\n2. Request Rider\n3. My Wallet Balance\n\nReply with number:");
    } else if (menu === "book") {
      setUssdText("Rider requested to " + input + ". You will receive an SMS with rider details.\n0. Back to Main");
      setMenu("status");
    }
    setInput("");
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-black rounded-[3rem] p-3 shadow-2xl border-4 border-slate-800 h-[700px] flex flex-col relative overflow-hidden">
        
        {/* Phone Notch */}
        <div className="absolute top-0 inset-x-0 h-7 flex justify-center">
          <div className="w-32 h-6 bg-slate-900 rounded-b-3xl"></div>
        </div>

        {/* Status Bar */}
        <div className="flex justify-between items-center px-6 pt-3 text-[10px] font-medium text-white mb-6">
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <div className="flex items-center gap-1.5">
            <SignalHigh className="h-3 w-3" />
            <span className="opacity-80">3G</span>
          </div>
        </div>

        <div className="flex-1 px-4 flex flex-col">
          <button onClick={() => window.history.back()} className="text-white/50 mb-8 self-start p-2">
            <ArrowLeft className="h-6 w-6" />
          </button>

          {menu === "dialer" ? (
            <div className="flex flex-col items-center flex-1 justify-end pb-12">
              <div className="text-white text-4xl mb-12 h-10 tracking-widest">{input}</div>
              
              <div className="grid grid-cols-3 gap-6 w-full max-w-[260px] mx-auto mb-8">
                {['1','2','3','4','5','6','7','8','9','*','0','#'].map((key) => (
                  <button 
                    key={key} 
                    onClick={() => setInput(p => p + key)}
                    className="h-16 w-16 rounded-full bg-slate-800 text-white text-2xl active:bg-slate-700 transition-colors flex items-center justify-center"
                  >
                    {key}
                  </button>
                ))}
              </div>

              <button 
                onClick={handleDial}
                className="h-16 w-16 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 active:scale-95 transition-all"
              >
                <Phone className="h-7 w-7 fill-current" />
              </button>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center relative">
              {/* USSD Modal */}
              <div className="bg-slate-800 w-full rounded-md shadow-lg border border-slate-700">
                <div className="p-4 border-b border-slate-700 text-slate-200 whitespace-pre-wrap text-sm leading-relaxed">
                  {ussdText}
                </div>
                <div className="p-2">
                  <input 
                    type="text" 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    className="w-full bg-slate-900 border-b-2 border-emerald-500 text-white p-2 outline-none"
                    autoFocus
                  />
                </div>
                <div className="flex p-2 gap-2">
                  <button onClick={() => { setMenu("dialer"); setInput(""); }} className="flex-1 py-2 text-slate-400 font-medium text-sm rounded-md active:bg-slate-700">CANCEL</button>
                  <button onClick={handleReply} className="flex-1 py-2 text-emerald-400 font-medium text-sm rounded-md active:bg-slate-700">SEND</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <p className="text-slate-500 text-xs mt-6 text-center max-w-xs">
        Demonstration of USSD offline fallback logic. Dial *123# to test.
      </p>
    </div>
  );
}
