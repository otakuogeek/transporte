import { useEffect, useRef, useState } from 'react';
import api from '../api/client';

const TIPO_BADGES = {
  cliente: { label: 'Cliente', cls: 'bg-primary-subtle text-primary' },
  transporte: { label: 'Transporte', cls: 'bg-warning-subtle text-warning' },
  chofer: { label: 'Chofer', cls: 'bg-info-subtle text-info' },
  desconocido: { label: '', cls: 'bg-secondary-subtle text-secondary' },
};

const DRAFT_KEY = 'falc_whatsapp_config_draft';

function createVerifyToken() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID().replace(/-/g, '');
  }
  return `falc${Date.now()}`;
}

function maskToken(token) {
  if (!token) return 'No cargado';
  if (token.length <= 12) return token;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function sourceLabel(source) {
  if (source === 'database') return 'Panel';
  if (source === 'env') return 'Servidor';
  return 'Sin cargar';
}

export default function WhatsApp() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [saving, setSaving] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [togglingAgent, setTogglingAgent] = useState(false);
  const [banner, setBanner] = useState(null);
  const [copiedField, setCopiedField] = useState('');
  const [hasDraft, setHasDraft] = useState(false);

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [metaApiConfigurado, setMetaApiConfigurado] = useState(false);
  const [setupStatus, setSetupStatus] = useState({
    phone_number_id: false,
    access_token: false,
    verify_token: false,
  });
  const [credentialSource, setCredentialSource] = useState({
    phoneNumberId: 'missing',
    accessToken: 'missing',
    verifyToken: 'missing',
  });
  const [lastValidation, setLastValidation] = useState(null);

  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');

  // Panel lateral de info del contacto
  const [contactInfo, setContactInfo] = useState(null);
  const [contactTickets, setContactTickets] = useState([]);
  const [etiquetas, setEtiquetas] = useState([]);
  const [notas, setNotas] = useState([]);
  const [seguimientos, setSeguimientos] = useState([]);
  const [newEtiqueta, setNewEtiqueta] = useState('');
  const [newNota, setNewNota] = useState('');
  const [newSeguimiento, setNewSeguimiento] = useState({ descripcion: '', fecha: '' });
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);

  const chatPollingRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const copyTimeoutRef = useRef(null);

  const checklist = [
    { key: 'phone_number_id', label: 'Phone Number ID' },
    { key: 'access_token', label: 'Access Token' },
    { key: 'verify_token', label: 'Verify Token' },
  ];
  const completedSteps = checklist.filter((item) => setupStatus[item.key]).length;
  const completionPercent = Math.round((completedSteps / checklist.length) * 100);
  const canSend = metaApiConfigurado;

  useEffect(() => {
    setHasDraft(!!localStorage.getItem(DRAFT_KEY));
    loadConfig();

    return () => {
      clearInterval(chatPollingRef.current);
      clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      phoneNumberId,
      accessToken,
      verifyToken,
      updatedAt: Date.now(),
    }));
    setHasDraft(true);
  }, [phoneNumberId, accessToken, verifyToken, loading]);

  useEffect(() => {
    if (activeTab === 'chat') {
      const syncChats = async () => {
        try {
          const res = await api.get('/whatsapp-config/chats');
          setChats(res.data || []);

          if (selectedChat?.telefono) {
            const msgRes = await api.get(`/whatsapp-config/chats/${selectedChat.telefono}`);
            setMessages(msgRes.data || []);
          }
        } catch (error) {
          console.error('Error cargando chats:', error);
        }
      };

      syncChats();
      chatPollingRef.current = setInterval(syncChats, 5000);
    } else {
      clearInterval(chatPollingRef.current);
    }

    return () => clearInterval(chatPollingRef.current);
  }, [activeTab, selectedChat?.telefono]);

  useEffect(() => {
    setMobileInfoOpen(false);
    if (selectedChat) {
      loadMessages(selectedChat.telefono);
      loadContactPanel(selectedChat.telefono);
    } else {
      setContactInfo(null);
      setContactTickets([]);
      setEtiquetas([]);
      setNotas([]);
      setSeguimientos([]);
    }
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadConfig() {
    try {
      const [configRes, statusRes] = await Promise.all([
        api.get('/whatsapp-config'),
        api.get('/whatsapp-config/status').catch(() => ({ data: null })),
      ]);

      const config = configRes.data || {};
      const draft = localStorage.getItem(DRAFT_KEY);
      const parsedDraft = draft ? JSON.parse(draft) : null;

      setPhoneNumberId(parsedDraft?.phoneNumberId || config.wa_phone_number_id || '');
      setAccessToken(parsedDraft?.accessToken || config.wa_access_token || '');
      setVerifyToken(parsedDraft?.verifyToken || config.wa_verify_token || config.suggested_verify_token || createVerifyToken());
      setWebhookUrl(config.webhook_url || `${window.location.origin}/webhook`);
      setMetaApiConfigurado(!!config.meta_api_configurado);
      setSetupStatus(config.setup_status || {
        phone_number_id: false,
        access_token: false,
        verify_token: false,
      });
      setCredentialSource(config.credential_source || {
        phoneNumberId: 'missing',
        accessToken: 'missing',
        verifyToken: 'missing',
      });
      if (statusRes.data) setLastValidation(statusRes.data);
    } catch (error) {
      console.error('Error cargando config WhatsApp:', error);
      setBanner({ type: 'danger', text: 'No se pudo cargar la configuración de WhatsApp.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig(validateAfterSave = true) {
    setSaving(true);
    setBanner(null);

    try {
      const res = await api.put('/whatsapp-config', {
        wa_phone_number_id: phoneNumberId.trim(),
        wa_access_token: accessToken.trim(),
        wa_verify_token: verifyToken.trim(),
      });

      if (res.data?.wa_verify_token) setVerifyToken(res.data.wa_verify_token);
      if (res.data?.validation) setLastValidation(res.data.validation);

      await loadConfig();

      if (!validateAfterSave) {
        setBanner({ type: 'success', text: 'Configuración guardada.' });
      } else if (res.data?.validation?.ok) {
        setBanner({ type: 'success', text: 'Configuración guardada y conexión validada correctamente.' });
      } else {
        setBanner({ type: 'warning', text: res.data?.validation?.error || 'Configuración guardada. Falta validar la conexión.' });
      }
    } catch (error) {
      console.error('Error guardando configuración:', error);
      setBanner({ type: 'danger', text: error.response?.data?.error || 'No se pudo guardar la configuración.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckStatus() {
    setCheckingStatus(true);
    setBanner(null);

    try {
      const res = await api.get('/whatsapp-config/status');
      setLastValidation(res.data);
      if (res.data?.ok) {
        setBanner({ type: 'success', text: 'Meta respondió correctamente. La línea está lista para operar.' });
      } else {
        setBanner({ type: 'warning', text: res.data?.error || 'No se pudo validar la conexión.' });
      }
    } catch (error) {
      console.error('Error validando conexión:', error);
      setBanner({ type: 'danger', text: error.response?.data?.error || 'No se pudo validar la conexión con Meta.' });
    } finally {
      setCheckingStatus(false);
    }
  }

  function restoreDraft() {
    const rawDraft = localStorage.getItem(DRAFT_KEY);
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft);
      setPhoneNumberId(draft.phoneNumberId || '');
      setAccessToken(draft.accessToken || '');
      setVerifyToken(draft.verifyToken || createVerifyToken());
      setBanner({ type: 'info', text: 'Se restauró el borrador local.' });
    } catch (error) {
      console.error('Error restaurando borrador:', error);
    }
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
    setBanner({ type: 'info', text: 'Se limpió el borrador local.' });
  }

  function handleGenerateVerifyToken() {
    setVerifyToken(createVerifyToken());
    setBanner({ type: 'info', text: 'Se generó un Verify Token nuevo. Guarda para activarlo.' });
  }

  async function copyValue(value, field) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedField(''), 1800);
    } catch (error) {
      console.error('Error copiando valor:', error);
    }
  }

  async function loadChats() {
    try {
      const res = await api.get('/whatsapp-config/chats');
      setChats(res.data || []);

      if (selectedChat) {
        const msgRes = await api.get(`/whatsapp-config/chats/${selectedChat.telefono}`);
        setMessages(msgRes.data || []);
      }
    } catch (error) {
      console.error('Error cargando chats:', error);
    }
  }

  async function loadMessages(phone) {
    setChatLoading(true);
    try {
      const res = await api.get(`/whatsapp-config/chats/${phone}`);
      setMessages(res.data || []);
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    } finally {
      setChatLoading(false);
    }
  }

  async function loadContactPanel(phone) {
    try {
      const [infoRes, etqRes, notasRes, segRes] = await Promise.all([
        api.get(`/contacto/${phone}/info`),
        api.get(`/contacto/${phone}/etiquetas`),
        api.get(`/contacto/${phone}/notas`),
        api.get(`/contacto/${phone}/seguimientos`),
      ]);
      setContactInfo(infoRes.data?.contacto || null);
      setContactTickets(infoRes.data?.tickets || []);
      setEtiquetas(etqRes.data || []);
      setNotas(notasRes.data || []);
      setSeguimientos(segRes.data || []);
    } catch (error) {
      console.error('Error cargando panel contacto:', error);
    }
  }

  async function handleAddEtiqueta() {
    if (!newEtiqueta.trim() || !selectedChat) return;
    try {
      const res = await api.post(`/contacto/${selectedChat.telefono}/etiquetas`, { etiqueta: newEtiqueta.trim() });
      setEtiquetas(prev => [...prev, res.data]);
      setNewEtiqueta('');
    } catch (error) {
      console.error('Error agregando etiqueta:', error);
    }
  }

  async function handleRemoveEtiqueta(id) {
    try {
      await api.delete(`/contacto/etiquetas/${id}`);
      setEtiquetas(prev => prev.filter(e => e.id !== id));
    } catch (error) {
      console.error('Error eliminando etiqueta:', error);
    }
  }

  async function handleAddNota() {
    if (!newNota.trim() || !selectedChat) return;
    try {
      const res = await api.post(`/contacto/${selectedChat.telefono}/notas`, { contenido: newNota.trim() });
      setNotas(prev => [res.data, ...prev]);
      setNewNota('');
    } catch (error) {
      console.error('Error agregando nota:', error);
    }
  }

  async function handleRemoveNota(id) {
    try {
      await api.delete(`/contacto/notas/${id}`);
      setNotas(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error eliminando nota:', error);
    }
  }

  async function handleAddSeguimiento() {
    if (!newSeguimiento.descripcion.trim() || !newSeguimiento.fecha || !selectedChat) return;
    try {
      const res = await api.post(`/contacto/${selectedChat.telefono}/seguimientos`, {
        descripcion: newSeguimiento.descripcion.trim(),
        fecha_programada: newSeguimiento.fecha,
      });
      setSeguimientos(prev => [...prev, res.data]);
      setNewSeguimiento({ descripcion: '', fecha: '' });
    } catch (error) {
      console.error('Error agregando seguimiento:', error);
    }
  }

  async function handleToggleSeguimiento(id) {
    try {
      const res = await api.put(`/contacto/seguimientos/${id}/toggle`);
      setSeguimientos(prev => prev.map(s => s.id === id ? { ...s, completado: res.data.completado } : s));
    } catch (error) {
      console.error('Error actualizando seguimiento:', error);
    }
  }

  async function handleRemoveSeguimiento(id) {
    try {
      await api.delete(`/contacto/seguimientos/${id}`);
      setSeguimientos(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error eliminando seguimiento:', error);
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    if (!newMsg.trim() || !selectedChat || sending) return;

    setSending(true);
    const text = newMsg.trim();
    setNewMsg('');

    try {
      await api.post(`/whatsapp-config/chats/${selectedChat.telefono}/send`, { mensaje: text });
      const res = await api.get(`/whatsapp-config/chats/${selectedChat.telefono}`);
      setMessages(res.data || []);
      loadChats();
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      setNewMsg(text);
      setBanner({ type: 'danger', text: error.response?.data?.error || 'No se pudo enviar el mensaje.' });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function handleToggleAgent() {
    if (!selectedChat || togglingAgent) return;

    setTogglingAgent(true);
    try {
      const res = await api.post(`/whatsapp-config/chats/${selectedChat.telefono}/toggle-agent`);
      setSelectedChat((prev) => ({ ...prev, agente_pausado: res.data.agente_pausado, control: res.data.control || null }));
      setChats((prev) => prev.map((chat) => (
        chat.telefono === selectedChat.telefono
          ? { ...chat, agente_pausado: res.data.agente_pausado, control: res.data.control || null }
          : chat
      )));
    } catch (error) {
      console.error('Error cambiando estado del agente:', error);
      setBanner({ type: 'danger', text: error.response?.data?.error || 'No se pudo cambiar el estado del agente.' });
    } finally {
      setTogglingAgent(false);
    }
  }

  function getVentana24h(ultimoEntrante) {
    if (!ultimoEntrante) return { activa: false, nunca: true };
    const ahora = Date.now();
    const desde = new Date(ultimoEntrante).getTime();
    const limiteMs = 24 * 60 * 60 * 1000;
    const transcurrido = ahora - desde;
    if (transcurrido >= limiteMs) return { activa: false, nunca: false };
    const restante = limiteMs - transcurrido;
    const horas = Math.floor(restante / (60 * 60 * 1000));
    const minutos = Math.floor((restante % (60 * 60 * 1000)) / 60000);
    return { activa: true, horas, minutos };
  }

  function VentanaBadge({ ultimoEntrante, size = 'sm' }) {
    const v = getVentana24h(ultimoEntrante);
    const style = { fontSize: size === 'xs' ? 9 : 11 };
    if (v.nunca) return null;
    if (!v.activa) {
      return <span className="badge bg-danger-subtle text-danger" style={style}>🔒 Ventana cerrada</span>;
    }
    const urgente = v.horas < 2;
    return (
      <span className={`badge ${urgente ? 'bg-warning-subtle text-warning' : 'bg-success-subtle text-success'}`} style={style}>
        {urgente ? '⚠️' : '✅'} {v.horas}h {v.minutos}m libres
      </span>
    );
  }

  function formatTime(fecha) {
    const d = new Date(fecha);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);

    if (d.toDateString() === hoy.toDateString()) {
      return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }
    if (d.toDateString() === ayer.toDateString()) {
      return `Ayer ${d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `${d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
  }

  if (loading) {
    return <div className="text-center text-muted p-5">Cargando...</div>;
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-3">
        <div>
          <h1 className="h5 fw-semibold mb-1">Canal WhatsApp</h1>
          <p className="text-muted small mb-0">Configuración guiada de Meta Cloud API y gestión de conversaciones.</p>
        </div>
        <ul className="nav nav-pills nav-fill" style={{ minWidth: 260 }}>
          {[{ id: 'chat', label: 'Mensajes' }, { id: 'conexion', label: 'Conexión' }].map((tab) => (
            <li className="nav-item" key={tab.id}>
              <button className={`nav-link ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {banner && <div className={`alert alert-${banner.type} mb-3`}>{banner.text}</div>}

      {activeTab === 'conexion' && (
        <>
          <div
            className="card border-0 shadow-sm mb-3"
            style={{
              background: 'linear-gradient(135deg, #0f766e 0%, #14532d 100%)',
              color: '#f5f7f2',
              overflow: 'hidden',
            }}
          >
            <div className="card-body p-4">
              <div className="row g-4 align-items-center">
                <div className="col-lg-7">
                  <div className="text-uppercase fw-semibold" style={{ letterSpacing: 1.2, fontSize: 12, opacity: 0.85 }}>
                    Asistente de conexión
                  </div>
                  <h2 className="h4 fw-bold mt-2 mb-2">Configura la línea casi sin pasos manuales</h2>
                  <p className="mb-3" style={{ maxWidth: 640, color: 'rgba(245,247,242,0.82)' }}>
                    El panel ahora guarda las credenciales que realmente usa el backend, genera el verify token si hace falta y puede validar la línea contra Meta desde aquí mismo.
                  </p>
                  <div className="d-flex flex-wrap gap-2">
                    <button className="btn btn-light btn-sm" onClick={() => copyValue(webhookUrl, 'webhook-top')}>
                      {copiedField === 'webhook-top' ? 'Webhook copiado' : 'Copiar webhook'}
                    </button>
                    <button className="btn btn-outline-light btn-sm" onClick={handleGenerateVerifyToken}>
                      Generar token
                    </button>
                    <button className="btn btn-outline-light btn-sm" onClick={handleCheckStatus} disabled={checkingStatus}>
                      {checkingStatus ? 'Validando...' : 'Probar conexión'}
                    </button>
                  </div>
                </div>
                <div className="col-lg-5">
                  <div className="row g-3">
                    <div className="col-6">
                      <div className="rounded-4 p-3 h-100" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
                        <div className="small" style={{ color: 'rgba(245,247,242,0.78)' }}>Avance</div>
                        <div className="display-6 fw-bold mb-1">{completionPercent}%</div>
                        <div className="small">{completedSteps} de 3 pasos completos</div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="rounded-4 p-3 h-100" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
                        <div className="small" style={{ color: 'rgba(245,247,242,0.78)' }}>Estado</div>
                        <div className="fw-bold fs-5 mb-1">{lastValidation?.ok ? 'Validado' : metaApiConfigurado ? 'Configurado' : 'Pendiente'}</div>
                        <div className="small">{lastValidation?.verifiedName || 'Sin validación reciente'}</div>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="rounded-4 p-3" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="small fw-semibold">Checklist</span>
                          <span className="badge bg-light text-dark">Meta Cloud API</span>
                        </div>
                        <div className="d-flex flex-column gap-2">
                          {checklist.map((item) => (
                            <div key={item.key} className="d-flex align-items-center justify-content-between small">
                              <span>{item.label}</span>
                              <span className={`badge ${setupStatus[item.key] ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
                                {setupStatus[item.key] ? 'Listo' : 'Falta'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-xl-8">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body p-4">
                  <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-3">
                    <div>
                      <h6 className="fw-bold mb-1">Configuración principal</h6>
                      <p className="text-muted small mb-0">Carga los datos una sola vez y usa el botón de validar para confirmar que Meta ya responde.</p>
                    </div>
                    <span className={`badge ${metaApiConfigurado ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'} px-3 py-2`}>
                      {metaApiConfigurado ? 'Lista para usar' : 'Pendiente de activar'}
                    </span>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small">Phone Number ID</label>
                      <input className="form-control" value={phoneNumberId} onChange={(event) => setPhoneNumberId(event.target.value)} placeholder="Ej: 123456789012345" />
                      <div className="form-text">Lo encuentras en la configuración del producto WhatsApp dentro de Meta.</div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small d-flex justify-content-between">
                        <span>Verify Token</span>
                        <span className="text-muted">Webhook</span>
                      </label>
                      <div className="input-group">
                        <input className="form-control font-monospace" value={verifyToken} onChange={(event) => setVerifyToken(event.target.value)} placeholder="Se genera automáticamente si lo dejas vacío" />
                        <button className="btn btn-outline-secondary" type="button" onClick={handleGenerateVerifyToken}>Nuevo</button>
                        <button className="btn btn-outline-secondary" type="button" onClick={() => copyValue(verifyToken, 'verify')}>
                          {copiedField === 'verify' ? 'Copiado' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold small">Access Token</label>
                      <textarea className="form-control font-monospace" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder="Pega aquí el token permanente de Meta" rows={4} />
                      <div className="form-text">Después de guardarlo, el backend lo usa directamente para enviar y validar mensajes.</div>
                    </div>
                  </div>

                  <div className="rounded-4 p-3 mt-4" style={{ background: '#f5f7f2', border: '1px solid #d8e2d2' }}>
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                      <div className="fw-semibold">Webhook listo para Meta</div>
                      <button className="btn btn-outline-dark btn-sm" onClick={() => copyValue(webhookUrl, 'webhook-box')}>
                        {copiedField === 'webhook-box' ? 'Copiado' : 'Copiar URL'}
                      </button>
                    </div>
                    <div className="font-monospace small px-3 py-2 rounded-3" style={{ background: '#fff', border: '1px solid #d7dfd0' }}>
                      {webhookUrl}
                    </div>
                    <div className="small text-muted mt-2">
                      Usa esta URL en Meta for Developers, habilita el evento messages y pega el mismo Verify Token configurado aquí.
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2 mt-4">
                    <button className="btn btn-success px-4" onClick={() => handleSaveConfig(true)} disabled={saving}>
                      {saving ? 'Guardando...' : 'Guardar y validar'}
                    </button>
                    <button className="btn btn-outline-primary px-4" onClick={() => handleSaveConfig(false)} disabled={saving}>
                      Guardar sin validar
                    </button>
                    <button className="btn btn-outline-dark px-4" onClick={handleCheckStatus} disabled={checkingStatus}>
                      {checkingStatus ? 'Validando...' : 'Probar conexión'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-4">
              <div className="card border-0 shadow-sm mb-3">
                <div className="card-body p-4">
                  <h6 className="fw-bold mb-3">Resumen operativo</h6>
                  <div className="d-flex flex-column gap-3">
                    <div className="rounded-4 p-3" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                      <div className="small text-uppercase fw-semibold text-muted mb-1">Token visible</div>
                      <div className="fw-semibold">{maskToken(accessToken)}</div>
                    </div>
                    <div className="rounded-4 p-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                      <div className="small text-uppercase fw-semibold text-muted mb-1">Origen credenciales</div>
                      <div className="small">Phone Number ID: {sourceLabel(credentialSource.phoneNumberId)}</div>
                      <div className="small">Access Token: {sourceLabel(credentialSource.accessToken)}</div>
                      <div className="small">Verify Token: {sourceLabel(credentialSource.verifyToken)}</div>
                    </div>
                    <div className="rounded-4 p-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <div className="small text-uppercase fw-semibold text-muted mb-1">Última validación</div>
                      <div className="fw-semibold">{lastValidation?.ok ? 'Conexión correcta' : 'Sin validar o con error'}</div>
                      <div className="small text-muted mt-1">{lastValidation?.error || lastValidation?.phoneNumber || 'Todavía no hay una validación confirmada.'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card border-0 shadow-sm mb-3">
                <div className="card-body p-4">
                  <h6 className="fw-bold mb-3">Asistente rápido</h6>
                  <div className="d-flex flex-column gap-2">
                    <div className="rounded-3 px-3 py-2" style={{ background: '#f8fafc' }}>1. Copia el webhook y el verify token.</div>
                    <div className="rounded-3 px-3 py-2" style={{ background: '#f8fafc' }}>2. Pega el Access Token y el Phone Number ID.</div>
                    <div className="rounded-3 px-3 py-2" style={{ background: '#f8fafc' }}>3. Guarda y valida la línea desde este mismo panel.</div>
                  </div>
                </div>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                    <h6 className="fw-bold mb-0">Borrador local</h6>
                    <span className={`badge ${hasDraft ? 'bg-info-subtle text-info' : 'bg-secondary-subtle text-secondary'}`}>
                      {hasDraft ? 'Disponible' : 'Vacío'}
                    </span>
                  </div>
                  <p className="text-muted small mb-3">Los cambios quedan guardados localmente mientras completas la conexión.</p>
                  <div className="d-flex gap-2 flex-wrap">
                    <button className="btn btn-outline-secondary btn-sm" onClick={restoreDraft} disabled={!hasDraft}>Restaurar</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={clearDraft} disabled={!hasDraft}>Limpiar</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {lastValidation && (
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body p-4">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                  <div>
                    <h6 className="fw-bold mb-1">Diagnóstico en vivo</h6>
                    <p className="text-muted small mb-0">Resultado de la última comprobación directa contra Meta.</p>
                  </div>
                  <span className={`badge ${lastValidation.ok ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} px-3 py-2`}>
                    {lastValidation.ok ? 'Conexión OK' : 'Revisar'}
                  </span>
                </div>
                <div className="row g-3">
                  <div className="col-md-3">
                    <div className="rounded-4 p-3 h-100" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div className="small text-uppercase fw-semibold text-muted mb-1">Línea detectada</div>
                      <div className="fw-semibold">{lastValidation.phoneNumber || 'No disponible'}</div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="rounded-4 p-3 h-100" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div className="small text-uppercase fw-semibold text-muted mb-1">Nombre verificado</div>
                      <div className="fw-semibold">{lastValidation.verifiedName || 'No disponible'}</div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="rounded-4 p-3 h-100" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div className="small text-uppercase fw-semibold text-muted mb-1">Estado número</div>
                      <div className="fw-semibold">
                        <span className={`badge ${lastValidation.phoneStatus === 'CONNECTED' ? 'bg-success' : lastValidation.phoneStatus === 'PENDING' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                          {lastValidation.phoneStatus || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="rounded-4 p-3 h-100" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div className="small text-uppercase fw-semibold text-muted mb-1">Calidad</div>
                      <div className="fw-semibold text-capitalize">{lastValidation.qualityRating || 'No informada'}</div>
                    </div>
                  </div>
                </div>
                {lastValidation.autoRegistered && (
                  <div className="alert alert-info mt-3 mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-info-circle-fill"></i>
                    El número estaba en estado PENDING y fue registrado automáticamente en la Cloud API.
                  </div>
                )}
                {!lastValidation.ok && (
                  <div className="alert alert-warning mt-3 mb-0">
                    {lastValidation.error || 'Meta devolvió un error al validar la línea.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'chat' && (
        <div className="card border-0 shadow-sm overflow-hidden wa-chat-wrap d-flex flex-row" style={{ height: 'calc(100vh - 160px)', minHeight: 400 }}>
          <div className="wa-chat-sidebar border-end d-flex flex-column flex-shrink-0" style={{ width: 320, background: '#fcfcf8' }}>
            <div className="px-3 py-3 border-bottom">
              <div className="fw-bold small">Conversaciones</div>
              <div style={{ fontSize: 11 }} className="text-muted">{chats.length} contacto{chats.length !== 1 ? 's' : ''} · actualiza cada 5s</div>
            </div>
            <div className="overflow-auto flex-grow-1">
              {chats.length === 0 ? (
                <div className="text-center text-muted p-4 small">No hay conversaciones aún</div>
              ) : chats.map((chat) => {
                const badge = TIPO_BADGES[chat.tipo_contacto] || TIPO_BADGES.desconocido;
                const active = selectedChat?.telefono === chat.telefono;

                return (
                  <div
                    key={chat.telefono}
                    onClick={() => setSelectedChat(chat)}
                    className="px-3 py-3 border-bottom"
                    style={{ cursor: 'pointer', background: active ? '#ecfdf5' : 'transparent' }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <div className="position-relative flex-shrink-0">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                          style={{ width: 40, height: 40, fontSize: 14, background: 'linear-gradient(135deg, #0f766e 0%, #65a30d 100%)' }}
                        >
                          {(chat.nombre_contacto || chat.telefono).charAt(0).toUpperCase()}
                        </div>
                        {chat.agente_pausado && (
                          <span
                            className="position-absolute bottom-0 end-0 bg-warning border border-white rounded-circle d-flex align-items-center justify-content-center"
                            style={{ width: 14, height: 14, fontSize: 7 }}
                            title={chat.control ? `Control: ${chat.control.operador_nombre}` : 'Agente detenido'}
                          >
                            ✋
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-grow-1" style={{ overflow: 'hidden' }}>
                        <div className="d-flex justify-content-between align-items-center gap-2">
                          <span className="fw-semibold text-truncate" style={{ fontSize: 13, maxWidth: 130 }}>{chat.nombre_contacto || chat.telefono}</span>
                          <small className="text-muted flex-shrink-0" style={{ fontSize: 10 }}>{formatTime(chat.ultima_fecha)}</small>
                        </div>
                        <div className="d-flex align-items-center gap-1 mt-1">
                          {chat.ultima_direccion === 'saliente' && <small className="text-info">✓✓</small>}
                          <small className="text-muted text-truncate">{chat.ultimo_mensaje || ''}</small>
                        </div>
                        <div className="d-flex align-items-center gap-1 mt-1">
                          <small className="text-muted" style={{ fontSize: 10 }}>+{chat.telefono}</small>
                          {badge.label && <span className={`badge ${badge.cls}`} style={{ fontSize: 9 }}>{badge.label}</span>}
                          {chat.control && <span className="badge bg-warning-subtle text-warning" style={{ fontSize: 9 }}>{chat.control.operador_nombre}</span>}
                        </div>
                        <div className="mt-1">
                          <VentanaBadge ultimoEntrante={chat.ultimo_mensaje_entrante} size="xs" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {!selectedChat ? (
            <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-muted p-4">
              <div className="fw-semibold mt-2">Selecciona una conversación</div>
              <small>Elige un contacto de la lista para abrir el hilo.</small>
              {!metaApiConfigurado && (
                <div className="alert alert-warning mt-3 py-2 small mb-0">
                  La línea todavía no está configurada. Completa la pestaña Conexión para habilitar envíos manuales.
                </div>
              )}
            </div>
          ) : (
            <div className="flex-grow-1 d-flex flex-column min-w-0">
              <div className="px-3 py-3 border-bottom bg-light d-flex align-items-center gap-2">
                <button className="btn btn-sm btn-outline-secondary d-lg-none me-1" onClick={() => setSelectedChat(null)}>←</button>
                <div
                  className="d-flex align-items-center gap-2 flex-grow-1 min-w-0"
                  style={{ cursor: 'pointer' }}
                  onClick={() => window.innerWidth < 1200 ? setMobileInfoOpen(true) : setShowInfoPanel(p => !p)}
                  title="Ver información del contacto"
                >
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                    style={{ width: 40, height: 40, fontSize: 14, background: 'linear-gradient(135deg, #0f766e 0%, #65a30d 100%)' }}
                  >
                    {(selectedChat.nombre_contacto || selectedChat.telefono).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="fw-bold small">{selectedChat.nombre_contacto || selectedChat.telefono}</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>+{selectedChat.telefono}</div>
                  </div>
                </div>
                <div className="ms-auto d-flex align-items-center gap-2">
                  {selectedChat.agente_pausado && selectedChat.control && (
                    <span className="badge bg-warning-subtle text-warning small" style={{ fontSize: 11 }}>
                      🎧 {selectedChat.control.operador_nombre}
                    </span>
                  )}
                  {selectedChat.agente_pausado && !selectedChat.control && <span className="badge bg-warning-subtle text-warning small">Agente pausado</span>}
                  <VentanaBadge ultimoEntrante={selectedChat.ultimo_mensaje_entrante} size="sm" />
                  <button className={`btn btn-sm ${selectedChat.agente_pausado ? 'btn-success' : 'btn-warning'}`} onClick={handleToggleAgent} disabled={togglingAgent}>
                    {togglingAgent ? '...' : selectedChat.agente_pausado ? 'Reanudar' : 'Tomar control'}
                  </button>
                  <button
                    className={`btn btn-sm ${showInfoPanel ? 'btn-primary' : 'btn-outline-secondary'} d-none d-xl-inline-flex`}
                    onClick={() => setShowInfoPanel(p => !p)}
                    title="Panel de información"
                  >
                    ℹ️
                  </button>
                </div>
              </div>

              <div className="flex-grow-1 overflow-auto p-3 d-flex flex-column gap-2" style={{ background: '#f2f5ef' }}>
                {chatLoading ? (
                  <div className="text-center text-muted p-4">Cargando mensajes...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-muted p-4">No hay mensajes en esta conversación</div>
                ) : messages.map((msg, index) => {
                  const isOut = msg.direccion === 'saliente';
                  const isBot = isOut && msg.contexto === 'bot';
                  const isManual = isOut && msg.contexto === 'manual_admin';

                  return (
                    <div key={msg.id || index} className={`d-flex ${isOut ? 'justify-content-end' : 'justify-content-start'}`}>
                      <div
                        className="shadow-sm wa-msg-bubble"
                        style={{
                          padding: '10px 13px',
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: '#111',
                          borderRadius: isOut ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          background: isOut ? (isManual ? '#dbeafe' : '#dcfce7') : '#fff',
                        }}
                      >
                        {isManual && msg.operador_nombre && (
                          <div className="fw-semibold mb-1" style={{ fontSize: 11, color: '#3b82f6' }}>
                            🎧 {msg.operador_nombre}
                          </div>
                        )}
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.contenido}</div>
                        <div className="d-flex align-items-center justify-content-end gap-1 mt-1">
                          {isBot && <span className="badge bg-success-subtle text-success" style={{ fontSize: 9 }}>Bot</span>}
                          {isManual && <span className="badge bg-primary-subtle text-primary" style={{ fontSize: 9 }}>{msg.operador_nombre || 'Operador'}</span>}
                          <small className="text-muted" style={{ fontSize: 10 }}>{formatTime(msg.fecha)}</small>
                          {isOut && <small className="text-info" style={{ fontSize: 10 }}>✓✓</small>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {(() => {
                const v = getVentana24h(selectedChat.ultimo_mensaje_entrante);
                if (!v.activa && !v.nunca) {
                  return (
                    <div className="px-3 py-2 d-flex align-items-center gap-2" style={{ background: '#fef2f2', borderTop: '1px solid #fecaca', fontSize: 12 }}>
                      <span>🔒</span>
                      <span className="text-danger fw-semibold">Ventana de 24 h cerrada</span>
                      <span className="text-muted">— Para enviar mensajes proactivos usa una plantilla aprobada. Si el contacto te escribe primero, el temporizador se reinicia.</span>
                    </div>
                  );
                }
                if (v.activa && v.horas < 2) {
                  return (
                    <div className="px-3 py-2 d-flex align-items-center gap-2" style={{ background: '#fffbeb', borderTop: '1px solid #fde68a', fontSize: 12 }}>
                      <span>⚠️</span>
                      <span className="text-warning fw-semibold">Quedan {v.horas}h {v.minutos}m</span>
                      <span className="text-muted">— La ventana gratuita de 24 h está por cerrar.</span>
                    </div>
                  );
                }
                return null;
              })()}
              <form onSubmit={handleSend} className="p-2 p-sm-3 border-top bg-white d-flex align-items-center gap-2">
                <input
                  ref={inputRef}
                  value={newMsg}
                  onChange={(event) => setNewMsg(event.target.value)}
                  className="form-control rounded-pill"
                  style={{ fontSize: 14, padding: '10px 16px' }}
                  placeholder={metaApiConfigurado ? 'Escribe un mensaje...' : 'Primero configura la línea'}
                  disabled={!canSend || sending}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSend(event);
                    }
                  }}
                />
                <button type="submit" className="btn btn-success rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" disabled={!newMsg.trim() || !canSend || sending} style={{ width: 44, height: 44, fontSize: 18 }}>
                  {sending ? '...' : '➤'}
                </button>
              </form>
            </div>
          )}

          {/* Panel lateral de info del contacto */}
          {selectedChat && (showInfoPanel || mobileInfoOpen) && (
            <>
            {mobileInfoOpen && (
              <div
                className="d-xl-none"
                onClick={() => setMobileInfoOpen(false)}
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1040 }}
              />
            )}
            <div className={`wa-info-panel border-start flex-column flex-shrink-0 overflow-auto ${mobileInfoOpen ? 'wa-info-mobile-open d-flex' : 'd-none d-xl-flex'}`} style={{ width: 300, background: '#fafbfc' }}>
              {/* Botón cerrar en móvil */}
              {mobileInfoOpen && (
                <div className="d-xl-none px-3 py-2 border-bottom d-flex justify-content-between align-items-center" style={{ background: '#f8f9fa' }}>
                  <span className="fw-bold small">Información del contacto</span>
                  <button className="btn btn-sm btn-outline-secondary rounded-circle" onClick={() => setMobileInfoOpen(false)} style={{ width: 30, height: 30, padding: 0, lineHeight: 1 }}>✕</button>
                </div>
              )}
              {/* Cabecera del contacto */}
              <div className="text-center p-3 border-bottom" style={{ background: '#f8f9fa' }}>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold mx-auto mb-2"
                  style={{ width: 56, height: 56, fontSize: 20, background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                >
                  {(selectedChat.nombre_contacto || selectedChat.telefono).charAt(0).toUpperCase()}
                </div>
                <div className="fw-bold" style={{ fontSize: 14 }}>{selectedChat.nombre_contacto || selectedChat.telefono}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>+{selectedChat.telefono}</div>
              </div>

              {/* Datos del contacto */}
              <div className="p-3 border-bottom">
                <div className="d-flex align-items-center gap-1 mb-2">
                  <span style={{ fontSize: 13 }}>👤</span>
                  <span className="fw-semibold" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Datos del contacto</span>
                </div>
                {contactInfo ? (
                  <div className="d-flex flex-column gap-1">
                    <div className="d-flex justify-content-between" style={{ fontSize: 12 }}>
                      <span className="text-muted">Tipo</span>
                      <span className={`badge ${contactInfo.tipo === 'cliente' ? 'bg-primary-subtle text-primary' : contactInfo.tipo === 'transporte' ? 'bg-warning-subtle text-warning' : 'bg-info-subtle text-info'}`} style={{ fontSize: 10 }}>
                        {contactInfo.tipo}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between" style={{ fontSize: 12 }}>
                      <span className="text-muted">Registro</span>
                      <span>{contactInfo.fecha_registro ? new Date(contactInfo.fecha_registro).toLocaleDateString('es-CO') : '—'}</span>
                    </div>
                    {contactInfo.documento && (
                      <div className="d-flex justify-content-between" style={{ fontSize: 12 }}>
                        <span className="text-muted">Documento</span>
                        <span>{contactInfo.documento}</span>
                      </div>
                    )}
                    {contactInfo.estado && (
                      <div className="d-flex justify-content-between" style={{ fontSize: 12 }}>
                        <span className="text-muted">Estado</span>
                        <span>{contactInfo.estado}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-muted" style={{ fontSize: 12 }}>Contacto no registrado.</div>
                )}
              </div>

              {/* Tickets recientes */}
              <div className="p-3 border-bottom">
                <div className="d-flex align-items-center gap-1 mb-2">
                  <span style={{ fontSize: 13 }}>🎫</span>
                  <span className="fw-semibold" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tickets recientes</span>
                </div>
                {contactTickets.length === 0 ? (
                  <div className="text-muted" style={{ fontSize: 12 }}>Sin tickets registrados.</div>
                ) : contactTickets.map(t => (
                  <div key={t.id} className="rounded-3 p-2 mb-1" style={{ background: '#fff', border: '1px solid #e5e7eb', fontSize: 12 }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="fw-semibold">#{t.id}</span>
                      <span className={`badge ${t.estado?.includes('Confirmado') ? 'bg-success-subtle text-success' : t.estado?.includes('Pendiente') ? 'bg-warning-subtle text-warning' : 'bg-secondary-subtle text-secondary'}`} style={{ fontSize: 9 }}>
                        {(t.estado || t.estado_asignacion || '').substring(0, 20)}
                      </span>
                    </div>
                    <div className="text-muted mt-1">{t.origen} → {t.destino || '—'}</div>
                  </div>
                ))}
              </div>

              {/* Etiquetas */}
              <div className="p-3 border-bottom">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-1">
                    <span style={{ fontSize: 13 }}>🏷️</span>
                    <span className="fw-semibold" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Etiquetas</span>
                  </div>
                </div>
                <div className="d-flex flex-wrap gap-1 mb-2">
                  {etiquetas.length === 0 && <span className="text-muted" style={{ fontSize: 12 }}>Sin etiquetas.</span>}
                  {etiquetas.map(e => (
                    <span key={e.id} className="badge d-flex align-items-center gap-1" style={{ background: e.color || '#6c757d', color: '#fff', fontSize: 11 }}>
                      {e.etiqueta}
                      <span style={{ cursor: 'pointer', marginLeft: 2, fontSize: 10 }} onClick={() => handleRemoveEtiqueta(e.id)}>✕</span>
                    </span>
                  ))}
                </div>
                <div className="input-group input-group-sm">
                  <input
                    className="form-control"
                    placeholder="Nueva etiqueta..."
                    value={newEtiqueta}
                    onChange={ev => setNewEtiqueta(ev.target.value)}
                    onKeyDown={ev => ev.key === 'Enter' && (ev.preventDefault(), handleAddEtiqueta())}
                    style={{ fontSize: 12 }}
                  />
                  <button className="btn btn-outline-primary" onClick={handleAddEtiqueta} disabled={!newEtiqueta.trim()}>+</button>
                </div>
              </div>

              {/* Notas internas */}
              <div className="p-3 border-bottom">
                <div className="d-flex align-items-center gap-1 mb-2">
                  <span style={{ fontSize: 13 }}>📝</span>
                  <span className="fw-semibold" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notas internas</span>
                </div>
                <textarea
                  className="form-control mb-2"
                  rows={2}
                  placeholder="Agregar nota sobre este cliente..."
                  value={newNota}
                  onChange={ev => setNewNota(ev.target.value)}
                  style={{ fontSize: 12 }}
                />
                <button className="btn btn-warning btn-sm w-100 mb-2" onClick={handleAddNota} disabled={!newNota.trim()} style={{ fontSize: 12 }}>
                  + Agregar nota
                </button>
                {notas.length === 0 ? (
                  <div className="text-muted" style={{ fontSize: 12 }}>Sin notas registradas.</div>
                ) : notas.map(n => (
                  <div key={n.id} className="rounded-3 p-2 mb-1 position-relative" style={{ background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12 }}>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{n.contenido}</div>
                    <div className="d-flex justify-content-between align-items-center mt-1">
                      <small className="text-muted">{n.autor || '—'} · {n.fecha_creacion ? new Date(n.fecha_creacion).toLocaleDateString('es-CO') : ''}</small>
                      <span style={{ cursor: 'pointer', fontSize: 10, color: '#dc3545' }} onClick={() => handleRemoveNota(n.id)}>🗑️</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Seguimientos */}
              <div className="p-3">
                <div className="d-flex align-items-center gap-1 mb-2">
                  <span style={{ fontSize: 13 }}>📋</span>
                  <span className="fw-semibold" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Seguimientos</span>
                </div>
                <div className="d-flex flex-column gap-1 mb-2">
                  <input
                    className="form-control form-control-sm"
                    placeholder="Descripción del seguimiento..."
                    value={newSeguimiento.descripcion}
                    onChange={ev => setNewSeguimiento(p => ({ ...p, descripcion: ev.target.value }))}
                    style={{ fontSize: 12 }}
                  />
                  <div className="d-flex gap-1">
                    <input
                      type="datetime-local"
                      className="form-control form-control-sm"
                      value={newSeguimiento.fecha}
                      onChange={ev => setNewSeguimiento(p => ({ ...p, fecha: ev.target.value }))}
                      style={{ fontSize: 11 }}
                    />
                    <button className="btn btn-outline-success btn-sm flex-shrink-0" onClick={handleAddSeguimiento} disabled={!newSeguimiento.descripcion.trim() || !newSeguimiento.fecha}>+</button>
                  </div>
                </div>
                {seguimientos.length === 0 ? (
                  <div className="text-muted" style={{ fontSize: 12 }}>Sin seguimientos programados.</div>
                ) : seguimientos.map(s => (
                  <div key={s.id} className="rounded-3 p-2 mb-1 d-flex align-items-start gap-2" style={{ background: s.completado ? '#f0fdf4' : '#fff', border: `1px solid ${s.completado ? '#bbf7d0' : '#e5e7eb'}`, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={!!s.completado}
                      onChange={() => handleToggleSeguimiento(s.id)}
                      className="form-check-input mt-0 flex-shrink-0"
                      style={{ width: 16, height: 16 }}
                    />
                    <div className="flex-grow-1 min-w-0">
                      <div style={{ textDecoration: s.completado ? 'line-through' : 'none', opacity: s.completado ? 0.6 : 1 }}>{s.descripcion}</div>
                      <small className="text-muted">{s.fecha_programada ? new Date(s.fecha_programada).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</small>
                    </div>
                    <span style={{ cursor: 'pointer', fontSize: 10, color: '#dc3545' }} onClick={() => handleRemoveSeguimiento(s.id)}>🗑️</span>
                  </div>
                ))}
              </div>
            </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 991.98px) {
          .wa-chat-wrap {
            height: calc(100vh - 140px) !important;
          }

          .wa-chat-sidebar {
            width: ${selectedChat ? '0' : '100%'} !important;
            ${selectedChat ? 'display: none !important;' : 'display: flex !important;'}
            max-height: 100%;
            border-right: none !important;
          }

          .wa-chat-wrap > .flex-grow-1:not(.wa-info-panel) {
            display: ${selectedChat ? 'flex' : 'none'} !important;
          }
        }

        @media (min-width: 992px) and (max-width: 1199.98px) {
          .wa-chat-sidebar {
            width: 280px !important;
          }
        }

        @media (min-width: 1200px) {
          .wa-chat-sidebar {
            width: 300px !important;
          }
          .wa-info-panel {
            width: 290px !important;
          }
        }

        @media (min-width: 1400px) {
          .wa-chat-sidebar {
            width: 320px !important;
          }
          .wa-info-panel {
            width: 300px !important;
          }
        }

        .wa-chat-wrap .wa-msg-bubble {
          max-width: 75%;
        }

        @media (max-width: 575.98px) {
          .wa-chat-wrap .wa-msg-bubble {
            max-width: 88%;
          }
        }

        @media (max-width: 1199.98px) {
          .wa-info-panel.wa-info-mobile-open {
            position: fixed !important;
            top: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 340px !important;
            max-width: 85vw !important;
            z-index: 1050 !important;
            box-shadow: -4px 0 20px rgba(0,0,0,0.15) !important;
            border-left: 1px solid #e5e7eb !important;
            animation: waInfoSlideIn 0.25s ease-out;
          }
        }

        @keyframes waInfoSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
