import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  ScanLine, 
  X, 
  Camera, 
  Volume2, 
  VolumeX, 
  Repeat, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  ShoppingBag, 
  Sparkles,
  ArrowRight,
  Barcode
} from 'lucide-react';
import { playSuccessBeep, playErrorBeep } from '../../../utils/audio';

interface CashierBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: any[];
  addToCart: (product: any, qty?: number) => void;
}

interface ScannedSessionItem {
  id: string | number;
  sku: string;
  name: string;
  barcode: string;
  price: number;
  qty: number;
}

export const CashierBarcodeScannerModal: React.FC<CashierBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  addToCart
}) => {
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [continuousMode, setContinuousMode] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [manualCode, setManualCode] = useState<string>('');
  const [lastScanFeedback, setLastScanFeedback] = useState<{
    text: string;
    type: 'success' | 'error';
    name?: string;
    price?: number;
    timestamp: number;
  } | null>(null);
  const [sessionScans, setSessionScans] = useState<ScannedSessionItem[]>([]);

  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const readerId = 'cashier-barcode-scanner-viewport';
  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  const stopScanner = useCallback(async () => {
    if (qrCodeRef.current) {
      try {
        if (qrCodeRef.current.isScanning) {
          await qrCodeRef.current.stop();
        }
        qrCodeRef.current.clear();
      } catch (err) {
        console.warn('Failed to cleanly stop camera scanner:', err);
      }
      qrCodeRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const handleProductFound = useCallback((product: any, rawCode: string) => {
    if (soundEnabled) {
      playSuccessBeep();
    }

    addToCart(product, 1);

    setLastScanFeedback({
      text: `Added ${product.name}`,
      type: 'success',
      name: product.name,
      price: product.price,
      timestamp: Date.now()
    });

    setSessionScans(prev => {
      const existing = prev.find(item => item.sku === product.sku || item.id === product.id);
      if (existing) {
        return prev.map(item => 
          (item.sku === product.sku || item.id === product.id)
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      return [{
        id: product.id,
        sku: product.sku,
        name: product.name,
        barcode: product.barcode || rawCode,
        price: product.price,
        qty: 1
      }, ...prev];
    });

    if (!continuousMode) {
      setTimeout(() => {
        stopScanner();
        onClose();
      }, 700);
    }
  }, [soundEnabled, addToCart, continuousMode, stopScanner, onClose]);

  const handleCodeDetected = useCallback((rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    // Debounce to prevent runaway triggers for the same barcode within 1.3 seconds
    const now = Date.now();
    if (code === lastScannedCodeRef.current && (now - lastScannedTimeRef.current) < 1300) {
      return;
    }
    lastScannedCodeRef.current = code;
    lastScannedTimeRef.current = now;

    // Search product by barcode or sku (case-insensitive)
    const match = products.find(p => 
      (p.barcode && p.barcode.toString().trim().toLowerCase() === code.toLowerCase()) ||
      (p.sku && p.sku.toString().trim().toLowerCase() === code.toLowerCase())
    );

    if (match) {
      handleProductFound(match, code);
    } else {
      if (soundEnabled) {
        playErrorBeep();
      }
      setLastScanFeedback({
        text: `No product found for barcode: "${code}"`,
        type: 'error',
        timestamp: Date.now()
      });
    }
  }, [products, soundEnabled, handleProductFound]);

  const startScanner = useCallback(async (cameraId: string) => {
    await stopScanner();
    setErrorMsg('');

    // Wait a tick to ensure the reader div is mounted in the DOM
    await new Promise(r => setTimeout(r, 100));

    const element = document.getElementById(readerId);
    if (!element) {
      setErrorMsg('Scanner viewfinder element not found in DOM.');
      return;
    }

    try {
      const html5QrCode = new Html5Qrcode(readerId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF
        ]
      });

      qrCodeRef.current = html5QrCode;

      const config = {
        fps: 20,
        qrbox: (width: number, height: number) => {
          const minEdge = Math.min(width, height);
          const boxW = Math.round(minEdge * 0.85);
          return {
            width: boxW,
            height: Math.round(boxW * 0.45) // Wider rectangle optimized for linear 1D barcodes
          };
        }
      };

      await html5QrCode.start(
        cameraId,
        config,
        (decodedText) => {
          handleCodeDetected(decodedText);
        },
        () => {
          // Frame parse error - ignore to keep console clean
        }
      );

      setIsCameraActive(true);
      setErrorMsg('');
    } catch (err: any) {
      console.error('Failed to initialize barcode camera scanner:', err);
      setErrorMsg(err?.message || 'Unable to access camera. Check device permissions or test with manual input below.');
      setIsCameraActive(false);
    }
  }, [stopScanner, handleCodeDetected]);

  // Request cameras on open
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    setLastScanFeedback(null);

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer environment (back) camera on phones/tablets, or first available webcam
          const backCam = devices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('environment') ||
            d.label.toLowerCase().includes('rear')
          );
          const defaultCam = backCam || devices[0];
          setSelectedCameraId(defaultCam.id);
        } else {
          setErrorMsg('No camera detected on this device. You can type or paste barcodes manually below.');
        }
      })
      .catch((err) => {
        console.warn('Camera enumeration error:', err);
        setErrorMsg('Camera access is restricted or unavailable. You can type or paste barcodes manually below.');
      });

    return () => {
      stopScanner();
    };
  }, [isOpen, stopScanner]);

  // Start scanner when camera is selected
  useEffect(() => {
    if (isOpen && selectedCameraId) {
      startScanner(selectedCameraId);
    }
  }, [isOpen, selectedCameraId, startScanner]);

  // Handle manual code entry
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleCodeDetected(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  const totalSessionCount = sessionScans.reduce((sum, item) => sum + item.qty, 0);
  const totalSessionAmount = sessionScans.reduce((sum, item) => sum + (item.price * item.qty), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-slate-100 max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <ScanLine className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900">Live Barcode Scanner</h2>
                <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Active POS
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Scan any product barcode or QR code with camera</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Beep sound enabled' : 'Muted'}
              className={`p-2 rounded-xl transition-all ${
                soundEnabled 
                  ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' 
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Continuous Mode Toggle */}
            <button
              type="button"
              onClick={() => setContinuousMode(!continuousMode)}
              title={continuousMode ? 'Continuous scan enabled' : 'Single scan mode'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                continuousMode
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              {continuousMode ? 'Continuous' : 'Single Scan'}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={() => {
                stopScanner();
                onClose();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">
          
          {/* Camera Viewfinder Box */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-inner flex flex-col items-center justify-center min-h-[290px]">
            
            {/* html5-qrcode reader mounting element */}
            <div 
              id={readerId} 
              className="w-full max-w-md overflow-hidden" 
              style={{ minHeight: '260px' }}
            />

            {/* Target Laser Overlay */}
            {isCameraActive && (
              <div className="absolute pointer-events-none inset-0 flex items-center justify-center">
                <div className="w-[82%] max-w-[340px] h-[130px] relative border-2 border-dashed border-blue-400/70 rounded-xl bg-blue-500/5 shadow-[0_0_20px_rgba(59,130,246,0.15)] flex items-center justify-center">
                  
                  {/* Four Corner Brackets */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-400 rounded-tl"></div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-400 rounded-tr"></div>
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-400 rounded-bl"></div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-400 rounded-br"></div>

                  {/* Red Laser Sweep Line */}
                  <style>{`
                    @keyframes cashierLaserSweep {
                      0% { top: 8%; opacity: 0.8; }
                      50% { top: 88%; opacity: 1; }
                      100% { top: 8%; opacity: 0.8; }
                    }
                  `}</style>
                  <div 
                    className="absolute w-[94%] h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_2px_rgba(239,68,68,0.7)]"
                    style={{ animation: 'cashierLaserSweep 2s ease-in-out infinite' }}
                  />

                  <span className="text-[11px] font-bold text-white/80 bg-black/40 backdrop-blur-xs px-2.5 py-0.5 rounded-full tracking-wider">
                    ALIGN BARCODE HERE
                  </span>
                </div>
              </div>
            )}

            {/* Live Feedback Toast Banner in Viewfinder */}
            {lastScanFeedback && (
              <div className={`absolute top-4 inset-x-6 z-20 flex items-center justify-between p-3 rounded-xl backdrop-blur-md shadow-lg border animate-in slide-in-from-top duration-200 ${
                lastScanFeedback.type === 'success'
                  ? 'bg-emerald-950/90 text-emerald-200 border-emerald-700/50'
                  : 'bg-rose-950/90 text-rose-200 border-rose-700/50'
              }`}>
                <div className="flex items-center gap-2.5 truncate">
                  {lastScanFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                  <div className="truncate">
                    <p className="text-xs font-bold leading-tight truncate">{lastScanFeedback.text}</p>
                    {lastScanFeedback.price !== undefined && (
                      <p className="text-[11px] text-emerald-300 font-semibold mt-0.5">
                        Rs. {lastScanFeedback.price.toFixed(2)} · In Cart
                      </p>
                    )}
                  </div>
                </div>
                {lastScanFeedback.type === 'success' && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                    +1
                  </span>
                )}
              </div>
            )}

            {/* Error Overlay / Camera Not Allowed */}
            {errorMsg && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center text-white z-10">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3 border border-amber-500/20">
                  <Camera className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-200 mb-1">Camera Stream Inactive</p>
                <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">{errorMsg}</p>
                
                {/* Fallback buttons with mock barcodes from actual products */}
                {products && products.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 w-full max-w-md">
                    <p className="text-[11px] font-bold text-slate-400 mb-2 text-left">Quick test with inventory product:</p>
                    <div className="flex flex-wrap gap-1.5 justify-start">
                      {products.slice(0, 3).map((p) => (
                        <button
                          key={p.sku || p.id}
                          type="button"
                          onClick={() => handleCodeDetected(p.barcode || p.sku)}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 text-[11px] font-bold transition-all flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          {p.name.slice(0, 14)}... ({p.barcode || p.sku})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Camera Switcher Dropdown */}
            {cameras.length > 1 && (
              <div className="absolute bottom-3 right-3 z-10">
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-white text-xs">
                  <Camera className="w-3.5 h-3.5 text-blue-400" />
                  <select
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="bg-transparent text-white text-xs font-semibold outline-none cursor-pointer pr-2"
                  >
                    {cameras.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                        {c.label || `Camera ${c.id.slice(0, 4)}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Manual Barcode / SKU Input Form */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <label className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Barcode className="w-4 h-4 text-blue-600" />
              Manual Barcode or SKU Entry
              <span className="text-[11px] font-normal text-slate-400">(use when barcode cannot be read)</span>
            </label>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Enter barcode or SKU number (e.g. 479... or PRD-...)"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </form>
          </div>

          {/* Scanned Items in this Session */}
          {sessionScans.length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    Scanned This Session ({totalSessionCount} items)
                  </h3>
                </div>
                <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                  Total: Rs. {totalSessionAmount.toFixed(2)}
                </span>
              </div>

              <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto pr-1">
                {sessionScans.map((item, idx) => (
                  <div key={`${item.sku}-${idx}`} className="py-2 flex items-center justify-between text-xs">
                    <div className="truncate pr-3">
                      <p className="font-bold text-slate-800 truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-400 font-medium">Barcode: {item.barcode}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-black text-slate-900">
                        x{item.qty}
                      </span>
                      <span className="font-bold text-emerald-600 min-w-[70px] text-right">
                        Rs. {(item.price * item.qty).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Hardware USB scanners can also scan directly into POS anytime.
          </div>

          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            Done & View Cart <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
