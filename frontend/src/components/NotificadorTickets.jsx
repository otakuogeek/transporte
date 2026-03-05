import { useEffect, useRef, useCallback, useState } from 'react';
import api from '../api/client';

export default function NotificadorTickets() {
    const ultimoIdRef = useRef(null);
    const [toast, setToast] = useState(null);

    const playAlerta = useCallback(() => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            [
                { freq: 880, start: 0,    dur: 0.12 },
                { freq: 660, start: 0.14, dur: 0.12 },
                { freq: 880, start: 0.28, dur: 0.18 },
            ].forEach(({ freq, start, dur }) => {
                const osc  = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
                osc.start(ctx.currentTime + start);
                osc.stop(ctx.currentTime + start + dur + 0.05);
            });
        } catch (_) { /* audio bloqueado */ }
    }, []);

    const poll = useCallback(async () => {
        try {
            const { data } = await api.get('/tickets');
            if (!data.length) return;
            const maxId = Math.max(...data.map(t => t.id));
            if (ultimoIdRef.current === null) {
                ultimoIdRef.current = maxId;
                return;
            }
            const nuevos = data.filter(t => t.id > ultimoIdRef.current);
            if (nuevos.length > 0) {
                ultimoIdRef.current = maxId;
                playAlerta();
                setToast({ count: nuevos.length, nuevos });
                setTimeout(() => setToast(null), 7000);
                // Avisar a cualquier página que escuche para que refresque
                window.dispatchEvent(new CustomEvent('nuevo-ticket', { detail: { nuevos } }));
            }
        } catch (_) { /* silencioso */ }
    }, [playAlerta]);

    // Inicializar referencia al montar
    useEffect(() => {
        poll();
    }, [poll]);

    // Polling cada 15 segundos
    useEffect(() => {
        const id = setInterval(poll, 15000);
        return () => clearInterval(id);
    }, [poll]);

    if (!toast) return null;

    return (
        <>
            <style>{`
                @keyframes ntSlideIn {
                    from { transform: translateX(120%); opacity: 0; }
                    to   { transform: translateX(0);    opacity: 1; }
                }
                .nt-toast { animation: ntSlideIn 0.35s cubic-bezier(.22,.68,0,1.2); }
                .nt-toast:hover { filter: brightness(1.1); }
            `}</style>
            <div
                className="nt-toast"
                onClick={() => setToast(null)}
                style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 99999,
                    background: '#1b5e20', color: '#fff',
                    padding: '14px 18px', borderRadius: 10,
                    boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
                    cursor: 'pointer', minWidth: 290, maxWidth: 360,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 22 }}>🔔</span>
                    <strong style={{ fontSize: 15 }}>
                        {toast.count === 1
                            ? 'Nueva solicitud de transporte'
                            : `${toast.count} nuevas solicitudes`}
                    </strong>
                </div>
                {toast.nuevos.map(t => (
                    <div key={t.id} style={{ fontSize: 12, opacity: 0.9, paddingLeft: 32, marginBottom: 2 }}>
                        #{t.id} — {t.cliente_nombre || 'Cliente'} · {t.origen} → {t.destino}
                    </div>
                ))}
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8, paddingLeft: 32 }}>
                    Clic para cerrar · 🔗 <a href="/tickets" style={{ color: '#a5d6a7', textDecoration: 'underline' }}>Ver tickets</a>
                </div>
            </div>
        </>
    );
}
