// src/pages/WhatsApp.jsx - Configuración + Chat WhatsApp
import { useState, useEffect, useRef } from 'react';
import api from '../api/client';

const STATUS_COLORS = { connected: '#198754', connecting: '#fd7e14', disconnected: '#dc3545' };
const STATUS_LABELS = { connected: 'Conectado', connecting: 'Conectando...', disconnected: 'Desconectado' };
const STATUS_BS = { connected: 'success', connecting: 'warning', disconnected: 'danger' };

const TIPO_BADGES = {
  cliente:     { label: 'Cliente',    cls: 'bg-primary-subtle text-primary' },
  transporte:  { label: 'Transporte', cls: 'bg-warning-subtle text-warning' },
  chofer:      { label: 'Chofer',     cls: 'bg-info-subtle text-info' },
  desconocido: { label: '',           cls: 'bg-secondary-subtle text-secondary' },
};

export default function WhatsApp() {
  const [mode, setMode] = useState('api_oficial');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('conexion');

  // API Oficial
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');

  // Baileys
  const [baileysStatus, setBaileysStatus] = useState('disconnected');
  const [baileysPhone, setBaileysPhone] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [baileysMessage, setBaileysMessage] = useState('');
  const [connecting, setConnecting] = useState(false);
  const pollingRef = useRef(null);

  // Multi-sesión Baileys
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('default');
  const [newSessionName, setNewSessionName] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);

  // Chat
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

  /* ── Effects ── */
  useEffect(() => {
    loadSessions();
    loadConfig('default');
    return () => { clearInterval(pollingRef.current); clearInterval(chatPollingRef.current); };
  }, []);

  useEffect(() => {
    loadConfig(selectedSessionId);
    setSelectedChat(null);
    setMessages([]);
    if (activeTab === 'chat') loadChats();
  }, [selectedSessionId]);

  useEffect(() => {
    if (activeTab === 'chat') { loadChats(); chatPollingRef.current = setInterval(loadChats, 5000); }
    else clearInterval(chatPollingRef.current);
    return () => clearInterval(chatPollingRef.current);
  }, [activeTab]);

  useEffect(() => { if (selectedChat) loadMessages(selectedChat.telefono); }, [selectedChat]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* ── API handlers ── */
  async function loadSessions() {
    try {
      const res = await api.get('/whatsapp-config/baileys/sessions');
      const list = Array.isArray(res.data) ? res.data : [];
      setSessions(list);

      if (list.length > 0 && !list.find(s => s.session_id === selectedSessionId)) {
        setSelectedSessionId(list[0].session_id);
      }
    } catch (err) {
      console.error('Error cargando sesiones Baileys:', err);
    }
  }

  async function loadConfig(sessionId = selectedSessionId) {
    try {
      const res = await api.get('/whatsapp-config', { params: { session_id: sessionId } });
      setMode(res.data.modo_conexion || 'api_oficial');
      setPhoneNumberId(res.data.wa_phone_number_id || '');
      setAccessToken(res.data.wa_access_token || '');
      setVerifyToken(res.data.wa_verify_token || '');
      setBaileysStatus(res.data.baileys_status || 'disconnected');
      if (res.data.phone) setBaileysPhone(res.data.phone);
      if (res.data.baileys_status === 'connected') {
        try {
          const st = await api.get('/whatsapp-config/baileys/status', { params: { session_id: sessionId } });
          if (st.data.phone) setBaileysPhone(st.data.phone);
        } catch (_) {}
      }
    } catch (err) { console.error('Error cargando config WhatsApp:', err); }
    finally { setLoading(false); }
  }

  async function handleCreateSession() {
    if (!newSessionName.trim() || creatingSession) return;
    setCreatingSession(true);
    try {
      await api.post('/whatsapp-config/baileys/sessions', { nombre: newSessionName.trim() });
      setNewSessionName('');
      await loadSessions();
    } catch (err) {
      alert(err.response?.data?.error || 'Error creando sesión');
    } finally {
      setCreatingSession(false);
    }
  }

  async function handleDeleteSession() {
    if (selectedSessionId === 'default' || deletingSession) return;
    if (!confirm('¿Eliminar esta línea de WhatsApp? Esta acción desconecta y borra su sesión.')) return;

    setDeletingSession(true);
    try {
      await api.delete(`/whatsapp-config/baileys/sessions/${selectedSessionId}`);
      const nextId = 'default';
      setSelectedSessionId(nextId);
      await loadSessions();
      await loadConfig(nextId);
      if (selectedChat) {
        setSelectedChat(null);
        setMessages([]);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Error eliminando sesión');
    } finally {
      setDeletingSession(false);
    }
  }

  async function handleSaveConfig() {
    setSaving(true);
    try {
      await api.put('/whatsapp-config', { modo_conexion: mode, wa_phone_number_id: phoneNumberId, wa_access_token: accessToken, wa_verify_token: verifyToken });
      alert('Configuración guardada correctamente');
    } catch (err) { alert(err.response?.data?.error || 'Error guardando configuración'); }
    finally { setSaving(false); }
  }

  async function handleBaileysConnect() {
    setConnecting(true); setQrCode(null); setBaileysMessage('Iniciando conexión...');
    try {
      const res = await api.post('/whatsapp-config/baileys/connect', { session_id: selectedSessionId });
      setBaileysStatus(res.data.status); setQrCode(res.data.qr); setBaileysMessage(res.data.message || '');
      if (res.data.phone) setBaileysPhone(res.data.phone);
      startStatusPolling();
      loadSessions();
    } catch (err) { setBaileysMessage(err.response?.data?.error || 'Error conectando'); }
    finally { setConnecting(false); }
  }

  function startStatusPolling() {
    clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.get('/whatsapp-config/baileys/status', { params: { session_id: selectedSessionId } });
        setBaileysStatus(res.data.status); setQrCode(res.data.qr); setBaileysMessage(res.data.message || '');
        if (res.data.phone) setBaileysPhone(res.data.phone);
        if (res.data.status === 'connected' || res.data.status === 'disconnected') { clearInterval(pollingRef.current); pollingRef.current = null; }
        loadSessions();
      } catch (err) { console.error('Error polling status:', err); }
    }, 3000);
  }

  async function handleBaileysDisconnect() {
    try {
      const res = await api.post('/whatsapp-config/baileys/disconnect', { session_id: selectedSessionId });
      setBaileysStatus(res.data.status); setBaileysPhone(null); setQrCode(null); setBaileysMessage(res.data.message || 'Desconectado');
      clearInterval(pollingRef.current); pollingRef.current = null;
      loadSessions();
    } catch (err) { alert(err.response?.data?.error || 'Error desconectando'); }
  }

  async function loadChats() {
    try {
      const res = await api.get('/whatsapp-config/chats', { params: { session_id: selectedSessionId } });
      setChats(res.data);
      if (selectedChat) {
        const msgRes = await api.get(`/whatsapp-config/chats/${selectedChat.telefono}`, { params: { session_id: selectedSessionId } });
        setMessages(msgRes.data);
      }
    } catch (err) { console.error('Error cargando chats:', err); }
  }

  async function loadMessages(phone) {
    setChatLoading(true);
    try {
      const res = await api.get(`/whatsapp-config/chats/${phone}`, { params: { session_id: selectedSessionId } });
      setMessages(res.data);
    }
    catch (err) { console.error('Error cargando mensajes:', err); }
    finally { setChatLoading(false); }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!newMsg.trim() || !selectedChat || sending) return;
    setSending(true);
    const texto = newMsg.trim(); setNewMsg('');
    try {
      await api.post(`/whatsapp-config/chats/${selectedChat.telefono}/send`, { mensaje: texto, session_id: selectedSessionId });
      const res = await api.get(`/whatsapp-config/chats/${selectedChat.telefono}`, { params: { session_id: selectedSessionId } });
      setMessages(res.data);
      loadChats();
    } catch (err) { alert(err.response?.data?.error || 'Error enviando mensaje'); setNewMsg(texto); }
    finally { setSending(false); inputRef.current?.focus(); }
  }

  function formatTime(fecha) {
    const d = new Date(fecha), hoy = new Date(), ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === ayer.toDateString()) return 'Ayer ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  async function handleToggleAgent() {
    if (!selectedChat || togglingAgent) return;
    setTogglingAgent(true);
    try {
      const res = await api.post(`/whatsapp-config/chats/${selectedChat.telefono}/toggle-agent`, { session_id: selectedSessionId });
      setSelectedChat(prev => ({ ...prev, agente_pausado: res.data.agente_pausado }));
      setChats(prev => prev.map(c => c.telefono === selectedChat.telefono ? { ...c, agente_pausado: res.data.agente_pausado } : c));
    } catch (err) { alert(err.response?.data?.error || 'Error cambiando estado del agente'); }
    finally { setTogglingAgent(false); }
  }

  if (loading) return <div className="text-center text-muted p-5">Cargando...</div>;

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <h1 className="h5 fw-semibold mb-0">Canal WhatsApp</h1>
          <p className="text-muted small mb-0">Gestión de conexiones y conversaciones por línea</p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end wa-toolbar">
          <select
            className="form-select form-select-sm"
            style={{ minWidth: 180 }}
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
          >
            {sessions.map((s) => (
              <option key={s.session_id} value={s.session_id}>
                {s.nombre} ({s.session_id})
              </option>
            ))}
          </select>

          <input
            className="form-control form-control-sm"
            style={{ width: 170 }}
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            placeholder="Nueva línea"
          />
          <button className="btn btn-outline-primary btn-sm" onClick={handleCreateSession} disabled={creatingSession || !newSessionName.trim()}>
            {creatingSession ? 'Creando...' : 'Agregar'}
          </button>
          <button className="btn btn-outline-danger btn-sm" onClick={handleDeleteSession} disabled={deletingSession || selectedSessionId === 'default'}>
            Eliminar
          </button>

          <ul className="nav nav-pills nav-fill" style={{ minWidth: 260 }}>
            {[{ id: 'conexion', icon: '', label: 'Conexión' }, { id: 'chat', icon: '', label: 'Mensajes' }].map(t => (
              <li className="nav-item" key={t.id}>
                <button className={`nav-link ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ===== TAB CONEXIÓN ===== */}
      {activeTab === 'conexion' && (
        <>
          {/* Mode selector */}
          <div className="card shadow-sm mb-3">
            <div className="card-body">
              <h6 className="fw-bold mb-3">Modo de Conexión</h6>
              <div className="row g-2">
                {[
                  { id: 'baileys', icon: 'B', label: 'Baileys', sub: 'WhatsApp Web (QR)', color: 'var(--falc-primary)' },
                  { id: 'api_oficial', icon: 'M', label: 'API Oficial', sub: 'Meta WhatsApp Cloud API', color: 'var(--falc-primary)' },
                ].map(m => (
                  <div className="col-6" key={m.id}>
                    <div
                      className={`card h-100 text-center p-3 wa-mode-card ${mode === m.id ? 'wa-mode-card-active' : ''}`}
                      style={{
                        cursor: 'pointer',
                        borderColor: mode === m.id ? m.color : undefined,
                      }}
                      onClick={() => setMode(m.id)}
                    >
                      <div className="wa-mode-icon">{m.icon}</div>
                      <div className="fw-bold mt-1">{m.label}</div>
                      <small className="text-muted">{m.sub}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Baileys panel */}
          {mode === 'baileys' && (
            <div className="card shadow-sm mb-3">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                  <h6 className="fw-semibold mb-0">Conexión Baileys · <span className="text-muted">{selectedSessionId}</span></h6>
                  <span className={`badge rounded-pill bg-${STATUS_BS[baileysStatus]}-subtle text-${STATUS_BS[baileysStatus]} d-flex align-items-center gap-1`}>
                    <span className={`rounded-circle d-inline-block ${baileysStatus === 'connecting' ? 'wa-pulse' : ''}`}
                      style={{ width: 8, height: 8, background: STATUS_COLORS[baileysStatus] }} />
                    {STATUS_LABELS[baileysStatus]}
                  </span>
                </div>

                {baileysMessage && (
                  <div className={`alert alert-${STATUS_BS[baileysStatus]} py-2 small`}>
                    {baileysMessage}
                  </div>
                )}

                {qrCode && baileysStatus === 'connecting' && (
                  <div className="text-center p-4 mb-3 rounded-3 border border-2 border-success border-dashed" style={{ background: '#f8f9fa' }}>
                    <p className="text-muted small fw-medium mb-3">Escanea este código QR con tu WhatsApp</p>
                    <img src={qrCode} alt="QR Code WhatsApp" className="rounded-3 shadow" style={{ width: 250, height: 250 }} />
                    <p className="text-muted mt-3 mb-0" style={{ fontSize: 11 }}>Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
                  </div>
                )}

                {baileysStatus === 'connected' && (
                  <div className="text-center p-4 mb-3 rounded-3 wa-status-success">
                    <p className="fw-bold text-success mb-1">Línea conectada</p>
                    {baileysPhone && (
                      <span className="badge bg-white text-dark shadow-sm fs-6 px-3 py-2">+{baileysPhone}</span>
                    )}
                    <p className="text-success small mt-2 mb-2">Mensajería habilitada para esta sesión</p>
                    <button className="btn btn-falc btn-sm" onClick={() => setActiveTab('chat')}>Ver Mensajes</button>
                  </div>
                )}

                <div className="d-flex gap-2">
                  {baileysStatus !== 'connected' && (
                    <button className="btn btn-falc flex-fill" onClick={handleBaileysConnect} disabled={connecting}>
                      {connecting ? 'Conectando...' : 'Conectar WhatsApp'}
                    </button>
                  )}
                  {(baileysStatus === 'connected' || baileysStatus === 'connecting') && (
                    <button className="btn btn-danger flex-fill" onClick={handleBaileysDisconnect}>Desconectar</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* API Oficial panel */}
          {mode === 'api_oficial' && (
            <div className="card shadow-sm mb-3">
              <div className="card-body">
                <h6 className="fw-bold mb-3">API Oficial de Meta</h6>
                <div className="alert alert-info py-2 small">
                  Obtén estos datos desde <strong>Meta for Developers</strong> → Tu App → WhatsApp → Configuración de la API
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Phone Number ID</label>
                  <input className="form-control" value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} placeholder="Ej: 123456789012345" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Access Token</label>
                  <textarea className="form-control font-monospace" value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="Token de acceso permanente..." rows={3} />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Verify Token</label>
                  <input className="form-control" value={verifyToken} onChange={e => setVerifyToken(e.target.value)} placeholder="Token de verificación del webhook" />
                </div>
                <button className="btn btn-primary w-100" onClick={handleSaveConfig} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </div>
          )}

          {/* Info card */}
          <div className="card shadow-sm mb-0">
            <div className="card-body small">
              <h6 className="fw-bold mb-2">Información</h6>
              <p className="mb-1 text-muted"><strong>Baileys:</strong> conexión por WhatsApp Web con QR.</p>
              <p className="mb-0 text-muted"><strong>API Oficial:</strong> integración Cloud API de Meta para producción.</p>
            </div>
          </div>
        </>
      )}

      {/* ===== TAB CHAT ===== */}
      {activeTab === 'chat' && (
        <div className="card shadow-sm overflow-hidden wa-chat-wrap d-flex flex-row" style={{ height: 'calc(100vh - 160px)' }}>
          {/* Sidebar chats */}
          <div className="border-end d-flex flex-column flex-shrink-0" style={{ width: 280 }}>
            <div className="px-3 py-2 border-bottom bg-light">
              <div className="fw-bold small">Conversaciones</div>
              <div style={{ fontSize: 11 }} className="text-muted">{chats.length} contacto{chats.length !== 1 ? 's' : ''} · actualiza cada 5s</div>
            </div>
            <div className="overflow-auto flex-grow-1">
              {chats.length === 0 ? (
                <div className="text-center text-muted p-4 small">
                  No hay conversaciones aún
                </div>
              ) : chats.map(chat => {
                const badge = TIPO_BADGES[chat.tipo_contacto] || TIPO_BADGES.desconocido;
                const active = selectedChat?.telefono === chat.telefono;
                return (
                  <div key={chat.telefono} onClick={() => setSelectedChat(chat)}
                    className={`px-3 py-2 border-bottom ${active ? 'bg-success-subtle' : ''}`}
                    style={{ cursor: 'pointer' }}>
                    <div className="d-flex align-items-center gap-2">
                      <div className="position-relative flex-shrink-0">
                        <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold wa-avatar"
                          style={{ width: 38, height: 38, fontSize: 14 }}>
                          {(chat.nombre_contacto || chat.telefono).charAt(0).toUpperCase()}
                        </div>
                        {chat.agente_pausado && (
                          <span className="position-absolute bottom-0 end-0 bg-warning border border-white rounded-circle d-flex align-items-center justify-content-center"
                            style={{ width: 14, height: 14, fontSize: 7 }} title="Agente detenido">✋</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-grow-1" style={{ overflow: 'hidden' }}>
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="fw-semibold text-truncate" style={{ fontSize: 13, maxWidth: 120 }}>{chat.nombre_contacto || chat.telefono}</span>
                          <small className="text-muted flex-shrink-0" style={{ fontSize: 10 }}>{formatTime(chat.ultima_fecha)}</small>
                        </div>
                        <div className="d-flex align-items-center gap-1 mt-1">
                          {chat.ultima_direccion === 'saliente' && <small className="text-info">✓✓</small>}
                          <small className="text-muted text-truncate">{chat.ultimo_mensaje || ''}</small>
                        </div>
                        <div className="d-flex align-items-center gap-1 mt-1">
                          <small className="text-muted" style={{ fontSize: 10 }}>+{chat.telefono}</small>
                          {badge.label && <span className={`badge ${badge.cls}`} style={{ fontSize: 9 }}>{badge.label}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Messages panel */}
          {!selectedChat ? (
            <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-muted">
              <div className="fw-semibold mt-2">Selecciona una conversación</div>
              <small>Elige un contacto de la lista para ver los mensajes</small>
              {baileysStatus !== 'connected' && (
                <div className="alert alert-warning mt-3 py-2 small">
                  WhatsApp no está conectado. Ve a <strong>Conexión</strong> para activarlo.
                </div>
              )}
            </div>
          ) : (
            <div className="flex-grow-1 d-flex flex-column min-w-0">
              {/* Chat header */}
              <div className="px-3 py-2 border-bottom bg-light d-flex align-items-center gap-2">
                {/* Mobile back button */}
                <button className="btn btn-sm btn-outline-secondary d-md-none me-1" onClick={() => setSelectedChat(null)}>←</button>
                <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0 wa-avatar"
                  style={{ width: 38, height: 38, fontSize: 14 }}>
                  {(selectedChat.nombre_contacto || selectedChat.telefono).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="fw-bold small">{selectedChat.nombre_contacto || selectedChat.telefono}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>+{selectedChat.telefono}</div>
                </div>
                <div className="ms-auto d-flex align-items-center gap-2">
                  {selectedChat.agente_pausado && (
                    <span className="badge bg-warning-subtle text-warning small">Agente pausado</span>
                  )}
                  <button className={`btn btn-sm ${selectedChat.agente_pausado ? 'btn-success' : 'btn-warning'}`}
                    onClick={handleToggleAgent} disabled={togglingAgent}>
                    {togglingAgent ? '...' : selectedChat.agente_pausado ? 'Reanudar' : 'Pausar'}
                  </button>
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-grow-1 overflow-auto p-3 d-flex flex-column gap-2" style={{ background: '#f0f2f5' }}>
                {chatLoading ? (
                  <div className="text-center text-muted p-4">Cargando mensajes...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-muted p-4">No hay mensajes en esta conversación</div>
                ) : messages.map((msg, i) => {
                  const isOut = msg.direccion === 'saliente';
                  const isBot = isOut && msg.contexto === 'bot';
                  const isManual = isOut && msg.contexto === 'manual_admin';
                  return (
                    <div key={msg.id || i} className={`d-flex ${isOut ? 'justify-content-end' : 'justify-content-start'}`}>
                      <div className="shadow-sm" style={{
                        maxWidth: '75%', padding: '8px 12px', fontSize: 13, lineHeight: 1.5, color: '#111',
                        borderRadius: isOut ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        background: isOut ? (isManual ? '#e3f2fd' : '#dcf8c6') : '#fff',
                      }}>
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.contenido}</div>
                        <div className="d-flex align-items-center justify-content-end gap-1 mt-1">
                          {isBot && <span className="badge bg-success-subtle text-success" style={{ fontSize: 9 }}>Bot</span>}
                          {isManual && <span className="badge bg-primary-subtle text-primary" style={{ fontSize: 9 }}>Operador</span>}
                          <small className="text-muted" style={{ fontSize: 10 }}>{formatTime(msg.fecha)}</small>
                          {isOut && <small className="text-info" style={{ fontSize: 10 }}>✓✓</small>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Send form */}
              <form onSubmit={handleSend} className="p-2 border-top bg-white d-flex align-items-center gap-2">
                <input ref={inputRef} value={newMsg} onChange={e => setNewMsg(e.target.value)}
                  className="form-control rounded-pill"
                  placeholder={baileysStatus === 'connected' ? 'Escribe un mensaje...' : '⚠️ WhatsApp desconectado'}
                  disabled={baileysStatus !== 'connected' || sending}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                />
                <button type="submit" className="btn btn-success rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                  disabled={!newMsg.trim() || baileysStatus !== 'connected' || sending}
                  style={{ width: 42, height: 42 }}>
                  {sending ? '...' : '→'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .wa-pulse { animation: pulse 1.5s infinite; }
        @media(max-width:767.98px){
          .wa-chat-wrap { flex-direction: column !important; }
          .wa-chat-wrap > .border-end { width: 100% !important; max-height: 40vh; border-right: none !important; border-bottom: 1px solid #dee2e6 !important; }
          .wa-chat-wrap > .border-end { display: ${selectedChat ? 'none' : 'flex'} !important; }
          .wa-chat-wrap > .flex-grow-1:last-child { display: ${selectedChat ? 'flex' : 'none'} !important; }
        }
      `}</style>
    </div>
  );
}
