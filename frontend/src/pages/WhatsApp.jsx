// src/pages/WhatsApp.jsx - Configuración + Chat WhatsApp
import { useState, useEffect, useRef } from 'react';
import api from '../api/client';

const STATUS_COLORS = {
    connected: '#4caf50',
    connecting: '#ff9800',
    disconnected: '#f44336',
};

const STATUS_LABELS = {
    connected: 'Conectado',
    connecting: 'Conectando...',
    disconnected: 'Desconectado',
};

export default function WhatsApp() {
    const [mode, setMode] = useState('api_oficial');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('conexion'); // 'conexion' | 'chat'

    // API Oficial fields
    const [phoneNumberId, setPhoneNumberId] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [verifyToken, setVerifyToken] = useState('');

    // Baileys state
    const [baileysStatus, setBaileysStatus] = useState('disconnected');
    const [baileysPhone, setBaileysPhone] = useState(null);
    const [qrCode, setQrCode] = useState(null);
    const [baileysMessage, setBaileysMessage] = useState('');
    const [connecting, setConnecting] = useState(false);
    const pollingRef = useRef(null);

    // Chat state
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMsg, setNewMsg] = useState('');
    const [sending, setSending] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);
    const [togglingAgent, setTogglingAgent] = useState(false);
    const chatPollingRef = useRef(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        loadConfig();
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (chatPollingRef.current) clearInterval(chatPollingRef.current);
        };
    }, []);

    useEffect(() => {
        if (activeTab === 'chat') {
            loadChats();
            chatPollingRef.current = setInterval(loadChats, 5000);
        } else {
            clearInterval(chatPollingRef.current);
        }
        return () => clearInterval(chatPollingRef.current);
    }, [activeTab]);

    useEffect(() => {
        if (selectedChat) loadMessages(selectedChat.telefono);
    }, [selectedChat]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    async function loadConfig() {
        try {
            const res = await api.get('/whatsapp-config');
            setMode(res.data.modo_conexion || 'api_oficial');
            setPhoneNumberId(res.data.wa_phone_number_id || '');
            setAccessToken(res.data.wa_access_token || '');
            setVerifyToken(res.data.wa_verify_token || '');
            setBaileysStatus(res.data.baileys_status || 'disconnected');
            if (res.data.phone) setBaileysPhone(res.data.phone);
            // Obtener n\u00famero si ya est\u00e1 conectado
            if (res.data.baileys_status === 'connected') {
                try {
                    const st = await api.get('/whatsapp-config/baileys/status');
                    if (st.data.phone) setBaileysPhone(st.data.phone);
                } catch (_) {}
            }
        } catch (err) {
            console.error('Error cargando config WhatsApp:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveConfig() {
        setSaving(true);
        try {
            await api.put('/whatsapp-config', {
                modo_conexion: mode,
                wa_phone_number_id: phoneNumberId,
                wa_access_token: accessToken,
                wa_verify_token: verifyToken,
            });
            alert('Configuración guardada correctamente');
        } catch (err) {
            alert(err.response?.data?.error || 'Error guardando configuración');
        } finally {
            setSaving(false);
        }
    }

    async function handleBaileysConnect() {
        setConnecting(true);
        setQrCode(null);
        setBaileysMessage('Iniciando conexión...');
        try {
            const res = await api.post('/whatsapp-config/baileys/connect');
            setBaileysStatus(res.data.status);
            setQrCode(res.data.qr);
            setBaileysMessage(res.data.message || '');
            if (res.data.phone) setBaileysPhone(res.data.phone);
            startStatusPolling();
        } catch (err) {
            setBaileysMessage(err.response?.data?.error || 'Error conectando');
        } finally {
            setConnecting(false);
        }
    }

    function startStatusPolling() {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = setInterval(async () => {
            try {
                const res = await api.get('/whatsapp-config/baileys/status');
                setBaileysStatus(res.data.status);
                setQrCode(res.data.qr);
                setBaileysMessage(res.data.message || '');
                if (res.data.phone) setBaileysPhone(res.data.phone);

                if (res.data.status === 'connected' || res.data.status === 'disconnected') {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
            } catch (err) {
                console.error('Error polling status:', err);
            }
        }, 3000);
    }

    async function handleBaileysDisconnect() {
        try {
            const res = await api.post('/whatsapp-config/baileys/disconnect');
            setBaileysStatus(res.data.status);
            setBaileysPhone(null);
            setQrCode(null);
            setBaileysMessage(res.data.message || 'Desconectado');
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Error desconectando');
        }
    }

    async function loadChats() {
        try {
            const res = await api.get('/whatsapp-config/chats');
            setChats(res.data);
            if (selectedChat) {
                const msgRes = await api.get(`/whatsapp-config/chats/${selectedChat.telefono}`);
                setMessages(msgRes.data);
            }
        } catch (err) { console.error('Error cargando chats:', err); }
    }

    async function loadMessages(phone) {
        setChatLoading(true);
        try {
            const res = await api.get(`/whatsapp-config/chats/${phone}`);
            setMessages(res.data);
        } catch (err) { console.error('Error cargando mensajes:', err); }
        finally { setChatLoading(false); }
    }

    async function handleSend(e) {
        e.preventDefault();
        if (!newMsg.trim() || !selectedChat || sending) return;
        setSending(true);
        const texto = newMsg.trim();
        setNewMsg('');
        try {
            await api.post(`/whatsapp-config/chats/${selectedChat.telefono}/send`, { mensaje: texto });
            const res = await api.get(`/whatsapp-config/chats/${selectedChat.telefono}`);
            setMessages(res.data);
            loadChats();
        } catch (err) {
            alert(err.response?.data?.error || 'Error enviando mensaje');
            setNewMsg(texto);
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    }

    function formatTime(fecha) {
        const d = new Date(fecha);
        const hoy = new Date();
        const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
        if (d.toDateString() === hoy.toDateString()) return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        if (d.toDateString() === ayer.toDateString()) return 'Ayer ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }

    async function handleToggleAgent() {
        if (!selectedChat || togglingAgent) return;
        setTogglingAgent(true);
        try {
            const res = await api.post(`/whatsapp-config/chats/${selectedChat.telefono}/toggle-agent`);
            // Actualizar el chat seleccionado y la lista
            setSelectedChat(prev => ({ ...prev, agente_pausado: res.data.agente_pausado }));
            setChats(prev => prev.map(c => c.telefono === selectedChat.telefono ? { ...c, agente_pausado: res.data.agente_pausado } : c));
        } catch (err) {
            alert(err.response?.data?.error || 'Error cambiando estado del agente');
        } finally {
            setTogglingAgent(false);
        }
    }

    const TIPO_BADGES = {
        cliente: { label: 'Cliente', color: '#1976d2', bg: '#e3f2fd' },
        transporte: { label: 'Transporte', color: '#e65100', bg: '#fff3e0' },
        chofer: { label: 'Chofer', color: '#6a1b9a', bg: '#f3e5f5' },
        desconocido: { label: '', color: '#888', bg: '#f5f5f5' },
    };

if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Cargando...</div>;

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h1 style={{ margin: 0, fontSize: 22, color: '#1a1a2e' }}>💬 WhatsApp</h1>
                <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 8, padding: 4, gap: 4 }}>
                    {[{ id: 'conexion', label: '⚙️ Conexión' }, { id: 'chat', label: '💬 Mensajes' }].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                            padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                            background: activeTab === tab.id ? '#fff' : 'transparent',
                            color: activeTab === tab.id ? '#1a1a2e' : '#888',
                            boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.2s',
                        }}>{tab.label}</button>
                    ))}
                </div>
            </div>

            {/* ===== TAB CONEXIÓN ===== */}
            {activeTab === 'conexion' && (
                <>
                    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 24 }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#333' }}>Modo de Conexión</h3>
                        <div style={{ display: 'flex', gap: 12 }}>
                            {[
                                { id: 'baileys', icon: '📱', label: 'Baileys', sub: 'WhatsApp Web (QR Code)', color: '#25D366', grad: 'linear-gradient(135deg, #128C7E 0%, #25D366 100%)' },
                                { id: 'api_oficial', icon: '🔗', label: 'API Oficial', sub: 'Meta WhatsApp Cloud API', color: '#0088cc', grad: 'linear-gradient(135deg, #0062E6 0%, #33AEFF 100%)' },
                            ].map(m => (
                                <button key={m.id} onClick={() => setMode(m.id)} style={{
                                    flex: 1, padding: '16px 20px', borderRadius: 10, cursor: 'pointer',
                                    border: mode === m.id ? `2px solid ${m.color}` : '2px solid #e0e0e0',
                                    background: mode === m.id ? m.grad : '#fafafa',
                                    color: mode === m.id ? '#fff' : '#555',
                                    fontWeight: 600, fontSize: 14, transition: 'all 0.3s ease',
                                    transform: mode === m.id ? 'scale(1.02)' : 'scale(1)',
                                }}>
                                    <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
                                    <div>{m.label}</div>
                                    <div style={{ fontSize: 11, fontWeight: 400, marginTop: 4, opacity: 0.85 }}>{m.sub}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {mode === 'baileys' && (
                        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                                <h3 style={{ margin: 0, fontSize: 16, color: '#333' }}>📱 Conexión Baileys</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: `${STATUS_COLORS[baileysStatus]}15`, border: `1px solid ${STATUS_COLORS[baileysStatus]}40` }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[baileysStatus], animation: baileysStatus === 'connecting' ? 'pulse 1.5s infinite' : 'none' }} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: STATUS_COLORS[baileysStatus] }}>{STATUS_LABELS[baileysStatus]}</span>
                                </div>
                            </div>

                            {baileysMessage && (
                                <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: baileysStatus === 'connected' ? '#e8f5e9' : baileysStatus === 'connecting' ? '#fff3e0' : '#fce4ec', color: baileysStatus === 'connected' ? '#2e7d32' : baileysStatus === 'connecting' ? '#e65100' : '#c62828', fontSize: 13 }}>
                                    {baileysMessage}
                                </div>
                            )}

                            {qrCode && baileysStatus === 'connecting' && (
                                <div style={{ textAlign: 'center', padding: 24, background: '#f8f9fa', borderRadius: 12, marginBottom: 20, border: '2px dashed #25D366' }}>
                                    <p style={{ margin: '0 0 16px', fontSize: 14, color: '#666', fontWeight: 500 }}>Escanea este código QR con tu WhatsApp</p>
                                    <img src={qrCode} alt="QR Code WhatsApp" style={{ width: 280, height: 280, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }} />
                                    <p style={{ margin: '16px 0 0', fontSize: 12, color: '#999' }}>Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
                                </div>
                            )}

                            {baileysStatus === 'connected' && (
                                <div style={{ textAlign: 'center', padding: 30, background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', borderRadius: 12, marginBottom: 20 }}>
                                    <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                                    <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#2e7d32' }}>WhatsApp conectado exitosamente</p>
                                    {baileysPhone && (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 10, background: '#fff', borderRadius: 20, padding: '6px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
                                            <span style={{ fontSize: 18 }}>📱</span>
                                            <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', letterSpacing: 1 }}>+{baileysPhone}</span>
                                        </div>
                                    )}
                                    <p style={{ margin: '10px 0 0', fontSize: 13, color: '#4caf50' }}>Los mensajes se enviarán a través de Baileys</p>
                                    <button onClick={() => setActiveTab('chat')} style={{ marginTop: 14, background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                                        💬 Ver Mensajes
                                    </button>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 10 }}>
                                {baileysStatus !== 'connected' && (
                                    <button onClick={handleBaileysConnect} disabled={connecting} style={{ flex: 1, padding: '12px 24px', borderRadius: 8, border: 'none', background: connecting ? '#ccc' : 'linear-gradient(135deg, #128C7E 0%, #25D366 100%)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: connecting ? 'not-allowed' : 'pointer' }}>
                                        {connecting ? '⏳ Conectando...' : '📱 Conectar WhatsApp'}
                                    </button>
                                )}
                                {(baileysStatus === 'connected' || baileysStatus === 'connecting') && (
                                    <button onClick={handleBaileysDisconnect} style={{ flex: 1, padding: '12px 24px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #e53935 0%, #ff5252 100%)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                                        🔌 Desconectar
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {mode === 'api_oficial' && (
                        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 24 }}>
                            <h3 style={{ margin: '0 0 20px', fontSize: 16, color: '#333' }}>🔗 API Oficial de Meta</h3>
                            <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 20, background: '#e3f2fd', border: '1px solid #90caf9', fontSize: 12, color: '#1565c0' }}>
                                💡 Obtén estos datos desde <strong>Meta for Developers</strong> → Tu App → WhatsApp → Configuración de la API
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#444' }}>Phone Number ID</label>
                                <input type="text" value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} placeholder="Ej: 123456789012345"
                                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#444' }}>Access Token</label>
                                <textarea value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="Token de acceso permanente..." rows={3}
                                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #ddd', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#444' }}>Verify Token</label>
                                <input type="text" value={verifyToken} onChange={e => setVerifyToken(e.target.value)} placeholder="Token de verificación del webhook"
                                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <button onClick={handleSaveConfig} disabled={saving} style={{ width: '100%', padding: '12px 24px', borderRadius: 8, border: 'none', background: saving ? '#ccc' : 'linear-gradient(135deg, #0062E6 0%, #33AEFF 100%)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer' }}>
                                {saving ? '⏳ Guardando...' : '💾 Guardar Configuración'}
                            </button>
                        </div>
                    )}

                    <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', borderRadius: 12, padding: 20, color: '#fff' }}>
                        <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>ℹ️ Información</h4>
                        <div style={{ fontSize: 12, lineHeight: 1.8, opacity: 0.85 }}>
                            <p style={{ margin: '0 0 8px' }}><strong>Baileys:</strong> Conecta directamente vía WhatsApp Web escaneando un QR. Ideal para pruebas y uso de bajo volumen.</p>
                            <p style={{ margin: 0 }}><strong>API Oficial:</strong> Usa la API Cloud de Meta. Recomendado para producción.</p>
                        </div>
                    </div>
                </>
            )}

            {/* ===== TAB CHAT ===== */}
            {activeTab === 'chat' && (
                <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden', height: 'calc(100vh - 160px)', display: 'flex' }}>
                    {/* Sidebar */}
                    <div style={{ width: 300, borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                        <div style={{ padding: '14px 16px', borderBottom: '1px solid #eee', background: '#f9f9f9' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>Conversaciones</div>
                            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{chats.length} contacto{chats.length !== 1 ? 's' : ''} · actualiza cada 5s</div>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {chats.length === 0 ? (
                                <div style={{ padding: 24, textAlign: 'center', color: '#bbb', fontSize: 13 }}>
                                    <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
                                    No hay conversaciones aún
                                </div>
                            ) : chats.map(chat => {
                                const badge = TIPO_BADGES[chat.tipo_contacto] || TIPO_BADGES.desconocido;
                                return (
                                <div key={chat.telefono} onClick={() => setSelectedChat(chat)}
                                    style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5', background: selectedChat?.telefono === chat.telefono ? '#e8f5e9' : 'transparent' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #128C7E, #25D366)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15 }}>
                                                {(chat.nombre_contacto || chat.telefono).charAt(0).toUpperCase()}
                                            </div>
                                            {chat.agente_pausado && (
                                                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#ff9800', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }} title="Agente detenido">✋</div>
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{chat.nombre_contacto || chat.telefono}</span>
                                                <span style={{ fontSize: 10, color: '#aaa', flexShrink: 0 }}>{formatTime(chat.ultima_fecha)}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                {chat.ultima_direccion === 'saliente' && <span style={{ fontSize: 10, color: '#34b7f1' }}>✓✓</span>}
                                                <span style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.ultimo_mensaje || ''}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                <span style={{ fontSize: 10, color: '#ccc' }}>+{chat.telefono}</span>
                                                {badge.label && (
                                                    <span style={{ fontSize: 9, color: badge.color, background: badge.bg, borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>{badge.label}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );})}
                        </div>
                    </div>

                    {/* Panel mensajes */}
                    {!selectedChat ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>
                            <div style={{ fontSize: 56, marginBottom: 12 }}>💬</div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: '#999' }}>Selecciona una conversación</div>
                            <div style={{ fontSize: 13, marginTop: 6 }}>Elige un contacto de la lista para ver los mensajes</div>
                            {baileysStatus !== 'connected' && (
                                <div style={{ marginTop: 20, background: '#fff3e0', border: '1px solid #ffe082', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#e65100' }}>
                                    ⚠️ WhatsApp no está conectado. Ve a <strong>Conexión</strong> para activarlo.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <div style={{ padding: '14px 20px', borderBottom: '1px solid #eee', background: '#f9f9f9', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #128C7E, #25D366)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>
                                    {(selectedChat.nombre_contacto || selectedChat.telefono).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{selectedChat.nombre_contacto || selectedChat.telefono}</div>
                                    <div style={{ fontSize: 12, color: '#aaa' }}>+{selectedChat.telefono}</div>
                                </div>
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {selectedChat.agente_pausado && (
                                        <span style={{ fontSize: 11, color: '#e65100', background: '#fff3e0', borderRadius: 6, padding: '3px 8px', fontWeight: 600 }}>🤚 Agente detenido</span>
                                    )}
                                    <button onClick={handleToggleAgent} disabled={togglingAgent} style={{
                                        padding: '7px 14px', borderRadius: 8, border: 'none', cursor: togglingAgent ? 'not-allowed' : 'pointer',
                                        fontWeight: 600, fontSize: 12, transition: 'all 0.2s',
                                        background: selectedChat.agente_pausado
                                            ? 'linear-gradient(135deg, #4caf50, #66bb6a)'
                                            : 'linear-gradient(135deg, #ff9800, #ffa726)',
                                        color: '#fff',
                                    }}>
                                        {togglingAgent ? '⏳' : selectedChat.agente_pausado ? '▶️ Activar Agente' : '⏸️ Detener Agente'}
                                    </button>
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#f0f2f5', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {chatLoading ? (
                                    <div style={{ textAlign: 'center', color: '#aaa', padding: 20 }}>Cargando mensajes...</div>
                                ) : messages.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#aaa', padding: 20 }}>No hay mensajes en esta conversación</div>
                                ) : messages.map((msg, i) => {
                                    const isOut = msg.direccion === 'saliente';
                                    const isBot = isOut && msg.contexto === 'bot';
                                    const isManual = isOut && msg.contexto === 'manual_admin';
                                    return (
                                        <div key={msg.id || i} style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start' }}>
                                            <div style={{ maxWidth: '70%', padding: '8px 12px', borderRadius: isOut ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: isOut ? (isManual ? '#e3f2fd' : '#dcf8c6') : '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', fontSize: 13, lineHeight: 1.5, color: '#111' }}>
                                                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.contenido}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
                                                    {isBot && <span style={{ fontSize: 9, color: '#4caf50', background: '#e8f5e9', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>🤖 Bot</span>}
                                                    {isManual && <span style={{ fontSize: 9, color: '#1976d2', background: '#e3f2fd', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>👤 Operador</span>}
                                                    <span style={{ fontSize: 10, color: '#aaa' }}>{formatTime(msg.fecha)}</span>
                                                    {isOut && <span style={{ fontSize: 10, color: '#34b7f1' }}>✓✓</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            <form onSubmit={handleSend} style={{ padding: '12px 16px', borderTop: '1px solid #eee', background: '#fff', display: 'flex', gap: 10, alignItems: 'center' }}>
                                <input ref={inputRef} value={newMsg} onChange={e => setNewMsg(e.target.value)}
                                    placeholder={baileysStatus === 'connected' ? 'Escribe un mensaje...' : '⚠️ WhatsApp desconectado'}
                                    disabled={baileysStatus !== 'connected' || sending}
                                    style={{ flex: 1, padding: '10px 14px', borderRadius: 20, border: '1.5px solid #ddd', outline: 'none', fontSize: 13, background: baileysStatus !== 'connected' ? '#fafafa' : '#fff' }}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                                />
                                <button type="submit" disabled={!newMsg.trim() || baileysStatus !== 'connected' || sending}
                                    style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: (!newMsg.trim() || baileysStatus !== 'connected' || sending) ? '#ccc' : 'linear-gradient(135deg, #128C7E, #25D366)', color: '#fff', fontSize: 18, cursor: (!newMsg.trim() || baileysStatus !== 'connected' || sending) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {sending ? '⏳' : '➤'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            )}

            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        </div>
    );
}
