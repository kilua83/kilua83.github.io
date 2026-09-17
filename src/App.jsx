import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Settings, Download, Plus, Edit2, Trash2, X, ArrowUpDown, ArrowUp, ArrowDown, FileText, Search, DollarSign, AlertCircle, CloudOff, CloudUpload, Check, Lock, LogOut, User, RefreshCw, List, Bell, LayoutGrid, Table, Layers, Palette } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import { login, getSessionToken, getSessionUser, logout } from './auth';
import { USER_GROUPS, getUserGroup } from './groups';
import './index.css';


const GITHUB_API_URL = 'https://api.github.com/repos';

function App() {
  const [authToken, setAuthToken] = useState(() => getSessionToken());
  const [currentUser, setCurrentUser] = useState(() => getSessionUser());
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  // 'idle' | 'saving' | 'saved' | 'error'
  const [syncStatus, setSyncStatus] = useState('idle');
  const isInitialLoad = useRef(true);

  // Detect native Capacitor platform and add body class for safe-area insets
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
      document.body.classList.add('is-native');
    }
  }, []);
  
  // GitHub Settings
  const [ghSettings, setGhSettings] = useState({
    token: getSessionToken() || localStorage.getItem('gh_token') || '',
    repo: localStorage.getItem('gh_repo') || import.meta.env.VITE_GITHUB_REPO || 'kilua83/kilua83.github.io',
    path: localStorage.getItem('gh_path') || import.meta.env.VITE_GITHUB_PATH || 'scadenziario/db.json'
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async (tokenOverride) => {
    const token = tokenOverride || authToken || ghSettings.token;
    const repo = ghSettings.repo;
    const path = ghSettings.path;

    setLoading(true);
    try {
      if (token && repo && path) {
        // Always fetch fresh from GitHub API (cache-buster via timestamp)
        const response = await fetch(
          `${GITHUB_API_URL}/${repo}/contents/${path}?t=${Date.now()}`,
          {
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            },
            cache: 'no-store'
          }
        );

        if (response.ok) {
          const json = await response.json();
          // GitHub returns base64 content possibly with newlines — strip them
          const rawBase64 = json.content.replace(/\n/g, '');
          const content = atob(rawBase64);
          const parsed = JSON.parse(content);
          setData(parsed);
          // Update local cache so offline fallback is fresh too
          localStorage.setItem('scadenziario_data', JSON.stringify(parsed));
          setLoading(false);
          return;
        } else {
          const errBody = await response.json().catch(() => ({}));
          console.error('GitHub API error', response.status, errBody);
          showToast(`Errore GitHub API (${response.status}) — riprovo da cache locale`, 'error');
        }
      }

      // Fallback: local cache (same device) or static db.json
      const localData = localStorage.getItem('scadenziario_data');
      if (localData) {
        setData(JSON.parse(localData));
        showToast('Dati da cache locale — potrebbero non essere aggiornati', 'error');
      } else {
        const response = await fetch('./db.json?t=' + Date.now());
        if (response.ok) {
          const json = await response.json();
          setData(json);
        }
      }
    } catch (err) {
      console.error('Error fetching data', err);
      showToast('Errore nel caricamento dati: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [authToken, ghSettings.repo, ghSettings.path]);

  useEffect(() => {
    if (authToken) {
      fetchData(authToken);
    }
  }, [authToken, fetchData]);

  const saveToGithub = useCallback(async (dataToSave, tokenOverride) => {
    const token = tokenOverride || authToken || ghSettings.token;
    const repo = ghSettings.repo;
    const path = ghSettings.path;

    if (!token || !repo || !path) {
      return;
    }

    setSyncStatus('saving');
    try {
      // 1. Get current file sha
      const getRes = await fetch(`${GITHUB_API_URL}/${repo}/contents/${path}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      let sha = '';
      if (getRes.ok) {
        const fileData = await getRes.json();
        sha = fileData.sha;
      }

      // 2. Update file
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(dataToSave, null, 2))));
      
      const updateRes = await fetch(`${GITHUB_API_URL}/${repo}/contents/${path}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Aggiornamento automatico scadenziario',
          content: content,
          sha: sha || undefined
        })
      });

      if (updateRes.ok) {
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2500);
      } else {
        throw new Error('Errore API GitHub');
      }
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
      showToast('Errore auto-salvataggio su GitHub', 'error');
      setTimeout(() => setSyncStatus('idle'), 4000);
    }
  }, [authToken, ghSettings.repo, ghSettings.path]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const formData = new FormData(e.target);
    const user = formData.get('username') || '';
    const pass = formData.get('password') || '';

    const res = await login(user, pass);
    setLoginLoading(false);

    if (res.success) {
      setAuthToken(res.token);
      setCurrentUser(user);
      setGhSettings(prev => ({ ...prev, token: res.token }));
      showToast(`Benvenuto, ${user}!`);
      fetchData(res.token);
    } else {
      setLoginError(res.error || 'Credenziali non valide');
    }
  };

  const handleLogout = () => {
    if (window.confirm("Sei sicuro di voler uscire dallo Scadenziario?")) {
      logout();
      setAuthToken(null);
      setCurrentUser(null);
      setData([]);
      setGhSettings(prev => ({ ...prev, token: '' }));
      showToast("Disconnessione effettuata");
    }
  };

  const handleSaveLocal = () => {
    localStorage.setItem('scadenziario_data', JSON.stringify(data));
    showToast('Copia locale salvata nel browser');
  };

  const downloadDbJson = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'db.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast("db.json scaricato con successo!");
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDueOnly, setFilterDueOnly] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  
  // View mode: 'compact' (default, super compact table for mobile/desktop), 'cards' (card layout), 'full' (desktop wide table)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('scadenziario_view_mode') || 'compact';
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('scadenziario_view_mode', mode);
  };

  // Sorting state (default: expireDate ascending)
  const [sortConfig, setSortConfig] = useState({ key: 'expireDate', direction: 'asc' });

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: key === 'dueAmount' ? 'desc' : 'asc' };
    });
  };

  const isValued = (v) => v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== '-';

  const isExpiring = (dateStr) => {
    if (!dateStr) return false;
    try {
      const date = parseISO(dateStr);
      const days = differenceInDays(date, new Date());
      return days <= 7;
    } catch {
      return false;
    }
  };

  const dueCount = useMemo(() => data.filter(i => isValued(i.dueAmount)).length, [data]);
  const expiringCount = useMemo(() => data.filter(i => isExpiring(i.expireDate)).length, [data]);

  const groupCounts = useMemo(() => {
    const counts = {};
    USER_GROUPS.forEach(g => { counts[g.id] = 0; });
    data.forEach(item => {
      const grp = getUserGroup(item.username, item.group);
      if (grp) counts[grp.id] = (counts[grp.id] || 0) + 1;
    });
    return counts;
  }, [data]);

  const processedData = useMemo(() => {
    let result = [...data];

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(item => 
        (item.username && item.username.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        (item.plan && item.plan.toLowerCase().includes(q)) ||
        (item.credits && item.credits.toLowerCase().includes(q)) ||
        (item.dueAmount && String(item.dueAmount).toLowerCase().includes(q))
      );
    }

    // Due only toggle
    if (filterDueOnly) {
      result = result.filter(item => isValued(item.dueAmount));
    }

    // Group filter
    if (selectedGroup) {
      result = result.filter(item => {
        const grp = getUserGroup(item.username, item.group);
        return grp?.id === selectedGroup;
      });
    }

    if (!sortConfig.key) return result;

    return result.sort((a, b) => {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];

      // Custom logic for dueAmount: valued fields ALWAYS appear at the top
      if (sortConfig.key === 'dueAmount') {
        const valuedA = isValued(valA);
        const valuedB = isValued(valB);

        if (valuedA && !valuedB) return -1;
        if (!valuedA && valuedB) return 1;
        if (!valuedA && !valuedB) return 0;

        const cleanA = String(valA).replace(/[^0-9.-]+/g, '');
        const cleanB = String(valB).replace(/[^0-9.-]+/g, '');
        const numA = cleanA !== '' ? parseFloat(cleanA) : NaN;
        const numB = cleanB !== '' ? parseFloat(cleanB) : NaN;

        let cmp = 0;
        if (!isNaN(numA) && !isNaN(numB)) {
          cmp = numA - numB;
        } else {
          cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
        }
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      }

      if (!valA && !valB) return 0;
      if (!valA) return 1;
      if (!valB) return -1;

      if (sortConfig.key === 'expireDate') {
        const timeA = new Date(valA).getTime();
        const timeB = new Date(valB).getTime();
        return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
      }

      const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  }, [data, sortConfig, searchTerm, filterDueOnly, selectedGroup]);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(processedData.map(item => ({
      Username: item.username,
      Piano: item.plan,
      'Data Scadenza': item.expireDate ? format(parseISO(item.expireDate), 'dd/MM/yyyy') : '',
      Note: item.notes,
      'Tipo Lista': item.credits,
      'Da Pagare (Avere)': item.dueAmount,
      Restanti: item.remaining
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Scadenziario");
    XLSX.writeFile(wb, "scadenziario.xlsx");
  };

  const handleSaveItem = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newItem = {
      id: editingItem?.id || Date.now().toString(),
      username: formData.get('username'),
      plan: formData.get('plan'),
      expireDate: formData.get('expireDate'),
      notes: formData.get('notes'),
      credits: formData.get('credits'),
      dueAmount: formData.get('dueAmount'),
      remaining: formData.get('remaining'),
      group: formData.get('group') || null
    };

    let newData;
    if (editingItem) {
      newData = data.map(item => item.id === editingItem.id ? newItem : item);
    } else {
      newData = [...data, newItem];
    }
    
    setData(newData);
    localStorage.setItem('scadenziario_data', JSON.stringify(newData));
    saveToGithub(newData);
    setShowModal(false);
  };

  const deleteItem = (id) => {
    if (window.confirm("Sei sicuro di voler eliminare questa riga?")) {
      const newData = data.filter(item => item.id !== id);
      setData(newData);
      localStorage.setItem('scadenziario_data', JSON.stringify(newData));
      saveToGithub(newData);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const saveSettings = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newSettings = {
      token: formData.get('token'),
      repo: formData.get('repo'),
      path: formData.get('path')
    };
    
    setGhSettings(newSettings);
    localStorage.setItem('gh_token', newSettings.token);
    localStorage.setItem('gh_repo', newSettings.repo);
    localStorage.setItem('gh_path', newSettings.path);
    
    setShowSettings(false);
    showToast("Impostazioni salvate");
    
    if (newSettings.token) {
      setTimeout(fetchData, 500);
    }
  };

  if (!authToken) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-icon-badge">
              <Lock size={28} />
            </div>
            <h2>Scadenziario</h2>
            <p>Area protetta. Inserisci le credenziali per accedere.</p>
          </div>

          {loginError && (
            <div className="login-error">
              <AlertCircle size={18} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label>Username</label>
              <input 
                type="text" 
                name="username" 
                defaultValue="adigennaro" 
                placeholder="es. adigennaro" 
                required 
                autoFocus 
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                name="password" 
                placeholder="••••••••••••" 
                required 
              />
            </div>
            <button type="submit" className="login-submit-btn" disabled={loginLoading}>
              {loginLoading ? (
                <>
                  <div className="loading-spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                  <span>Verifica credenziali...</span>
                </>
              ) : (
                <>
                  <Lock size={18} />
                  <span>Accedi</span>
                </>
              )}
            </button>
          </form>
        </div>

        {toast && (
          <div className={`toast ${toast.type}`}>
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  // ── Card renderer for mobile layout ──────────────────────────────────────
  // ── Ultra-Compact table for mobile/desktop (no horizontal swipe required) ──
  const renderCompactTable = () => {
    if (processedData.length === 0) {
      return (
        <div className="empty-state">
          <Search size={40} />
          <p>{searchTerm ? 'Nessun risultato trovato.' : 'Nessun dato presente.'}</p>
        </div>
      );
    }
    return (
      <div className="compact-table-wrapper">
        <table className="compact-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('username')} className="sortable-th">
                <div className="th-content">
                  <span>Utente / Info</span>
                  {sortConfig.key === 'username' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={12} style={{ color: 'var(--accent)' }} /> : <ArrowDown size={12} style={{ color: 'var(--accent)' }} />
                  ) : (
                    <ArrowUpDown size={12} style={{ opacity: 0.3 }} />
                  )}
                </div>
              </th>
              <th onClick={() => handleSort('expireDate')} className="sortable-th" style={{ width: '90px' }}>
                <div className="th-content">
                  <span>Scadenza</span>
                  {sortConfig.key === 'expireDate' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={12} style={{ color: 'var(--accent)' }} /> : <ArrowDown size={12} style={{ color: 'var(--accent)' }} />
                  ) : (
                    <ArrowUpDown size={12} style={{ opacity: 0.3 }} />
                  )}
                </div>
              </th>
              <th onClick={() => handleSort('dueAmount')} className="sortable-th" style={{ width: '80px' }}>
                <div className="th-content">
                  <span>Da Pagare</span>
                  {sortConfig.key === 'dueAmount' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={12} style={{ color: 'var(--accent)' }} /> : <ArrowDown size={12} style={{ color: 'var(--accent)' }} />
                  ) : (
                    <ArrowUpDown size={12} style={{ opacity: 0.3 }} />
                  )}
                </div>
              </th>
              <th style={{ width: '60px', textAlign: 'center' }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {processedData.map((item, index) => {
              const expiring = isExpiring(item.expireDate);
              const grp = getUserGroup(item.username, item.group);
              return (
                <tr 
                  key={item.id || index} 
                  className={`compact-row${expiring ? ' expiring' : ''}`}
                  style={grp ? { borderLeft: `4px solid ${grp.color}`, background: `linear-gradient(90deg, ${grp.bg} 0%, rgba(255, 255, 255, 0.02) 40%)` } : {}}
                >
                  <td className="compact-col-user">
                    <div className="compact-user-main">
                      <span className="compact-username">{item.username || '—'}</span>
                      {grp && (
                        <span 
                          className="group-pill-mini" 
                          style={{ backgroundColor: grp.color, color: grp.badgeText || '#fff' }}
                          title={grp.label}
                        >
                          {grp.label.split(' ')[0]}
                        </span>
                      )}
                    </div>
                    {(item.plan || item.notes || item.credits) && (
                      <div className="compact-user-sub">
                        {item.plan && <span className="sub-plan">{item.plan}</span>}
                        {item.credits && <span className="sub-credits">• {item.credits}</span>}
                        {item.notes && <span className="sub-notes">• 📝 {item.notes}</span>}
                      </div>
                    )}
                  </td>
                  <td className={`compact-col-date${expiring ? ' expiring-text' : ''}`}>
                    <div className="compact-date-cell">
                      <span>{item.expireDate ? format(parseISO(item.expireDate), 'dd/MM/yy') : '—'}</span>
                      {expiring && <span className="status-badge status-danger compact-badge">Scade</span>}
                    </div>
                  </td>
                  <td className="compact-col-due">
                    {isValued(item.dueAmount) ? (
                      <span className="due-badge compact-due">{item.dueAmount}</span>
                    ) : (
                      <span className="empty-dash">—</span>
                    )}
                  </td>
                  <td className="compact-col-actions">
                    <div className="compact-action-buttons">
                      <button className="icon-btn-mini edit" title="Modifica" onClick={() => openEditModal(item)}>
                        <Edit2 size={13} />
                      </button>
                      <button className="icon-btn-mini delete" title="Elimina" onClick={() => deleteItem(item.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ── Card renderer for mobile layout ──────────────────────────────────────
  const renderCards = () => {
    if (processedData.length === 0) {
      return (
        <div className="empty-state">
          <Search size={40} />
          <p>{searchTerm ? 'Nessun risultato trovato.' : 'Nessun dato presente.'}</p>
        </div>
      );
    }
    return (
      <div className="card-list">
        {processedData.map((item, index) => {
          const expiring = isExpiring(item.expireDate);
          const grp = getUserGroup(item.username, item.group);
          return (
            <div 
              key={item.id || index} 
              className={`user-card${expiring ? ' expiring' : ''}`}
              style={grp ? { borderLeft: `5px solid ${grp.color}`, background: `linear-gradient(90deg, ${grp.bg} 0%, rgba(30, 41, 59, 0.7) 40%)` } : {}}
            >
              <div className="card-header">
                <div className="card-user-info">
                  <span className="card-username">{item.username || '—'}</span>
                  {grp && (
                    <span 
                      className="group-pill" 
                      style={{ backgroundColor: grp.color, color: grp.badgeText || '#fff' }}
                    >
                      {grp.label}
                    </span>
                  )}
                </div>
                <div className="card-actions">
                  <button className="icon-btn edit" title="Modifica" onClick={() => openEditModal(item)}>
                    <Edit2 size={16} />
                  </button>
                  <button className="icon-btn delete" title="Elimina" onClick={() => deleteItem(item.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="card-meta">
                <div className="card-field">
                  <span className="card-field-label">Piano</span>
                  <span className={`card-field-value${!item.plan ? ' empty' : ''}`}>{item.plan || '—'}</span>
                </div>
                <div className="card-field">
                  <span className="card-field-label">Tipo Lista</span>
                  <span className={`card-field-value${!item.credits ? ' empty' : ''}`}>{item.credits || '—'}</span>
                </div>
                <div className="card-field">
                  <span className="card-field-label">Scadenza</span>
                  <span className={`card-field-value${expiring ? ' expiring-text' : ''}${!item.expireDate ? ' empty' : ''}`}>
                    {item.expireDate ? format(parseISO(item.expireDate), 'dd/MM/yyyy') : '—'}
                    {expiring && <span className="status-badge status-danger" style={{ marginLeft: '0.4rem', fontSize: '0.65rem' }}>⚠ Scade</span>}
                  </span>
                </div>
                <div className="card-field">
                  <span className="card-field-label">Da Pagare</span>
                  <span className="card-field-value">
                    {isValued(item.dueAmount)
                      ? <span className="due-badge">{item.dueAmount}</span>
                      : <span className="empty">—</span>
                    }
                  </span>
                </div>
              </div>

              {item.notes && (
                <div className="card-footer">
                  <span className="card-notes">📝 {item.notes}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Full Desktop Table renderer ──────────────────────────────────────────
  const renderFullTable = () => {
    return (
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th
                className="sortable-th"
                onClick={() => handleSort('username')}
                title="Clicca per ordinare per Username"
              >
                <div className="th-content">
                  <span>Username</span>
                  {sortConfig.key === 'username' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ color: 'var(--accent)' }} /> : <ArrowDown size={14} style={{ color: 'var(--accent)' }} />
                  ) : (
                    <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                  )}
                </div>
              </th>
              <th>Piano</th>
              <th
                className="sortable-th"
                onClick={() => handleSort('expireDate')}
                title="Clicca per ordinare per Data di Scadenza"
              >
                <div className="th-content">
                  <span>Scadenza</span>
                  {sortConfig.key === 'expireDate' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ color: 'var(--accent)' }} /> : <ArrowDown size={14} style={{ color: 'var(--accent)' }} />
                  ) : (
                    <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                  )}
                </div>
              </th>
              <th>Note</th>
              <th>Tipo Lista</th>
              <th
                className="sortable-th"
                onClick={() => handleSort('dueAmount')}
                title="Clicca per ordinare per Da Pagare (mostra prima i valorizzati)"
              >
                <div className="th-content">
                  <span>Da Pagare</span>
                  {sortConfig.key === 'dueAmount' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ color: 'var(--accent)' }} /> : <ArrowDown size={14} style={{ color: 'var(--accent)' }} />
                  ) : (
                    <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                  )}
                </div>
              </th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {processedData.map((item, index) => {
              const expiring = isExpiring(item.expireDate);
              const grp = getUserGroup(item.username, item.group);
              return (
                <tr 
                  key={item.id || index} 
                  className={expiring ? 'expiring' : ''}
                  style={grp ? { borderLeft: `4px solid ${grp.color}`, background: `linear-gradient(90deg, ${grp.bg} 0%, transparent 20%)` } : {}}
                >
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span>{item.username}</span>
                      {grp && (
                        <span 
                          className="group-pill-mini" 
                          style={{ backgroundColor: grp.color, color: grp.badgeText || '#fff' }}
                          title={grp.label}
                        >
                          {grp.label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{item.plan}</td>
                  <td className={expiring ? 'expiring-text' : ''}>
                    {item.expireDate ? format(parseISO(item.expireDate), 'dd/MM/yyyy') : '-'}
                    {expiring && <div className="status-badge status-danger" style={{ marginLeft: '0.5rem' }}>In scadenza</div>}
                  </td>
                  <td>{item.notes}</td>
                  <td>{item.credits}</td>
                  <td>
                    {isValued(item.dueAmount) ? (
                      <span className="due-badge">{item.dueAmount}</span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>-</span>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="icon-btn edit" title="Modifica" onClick={() => openEditModal(item)}>
                        <Edit2 size={16} />
                      </button>
                      <button className="icon-btn delete" title="Elimina" onClick={() => deleteItem(item.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {processedData.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                  {searchTerm ? 'Nessun risultato corrispondente alla ricerca.' : 'Nessun dato presente.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* ── Mobile topbar (only visible on small screens) ── */}
      <div className="mobile-topbar">
        <h1>Scadenziario</h1>
        <div className="mobile-topbar-right">
          {ghSettings.token ? (
            <div className={`sync-status sync-${syncStatus}`} style={{ fontSize: '0.7rem' }}>
              {syncStatus === 'saving' && <div className="loading-spinner" style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#60a5fa' }} />}
              {syncStatus === 'saved' && <Check size={12} />}
              {syncStatus === 'error' && <CloudOff size={12} />}
              {syncStatus === 'idle' && <CloudUpload size={12} />}
              <span>{
                syncStatus === 'saving' ? 'Salvo...' :
                syncStatus === 'saved' ? 'Salvato!' :
                syncStatus === 'error' ? 'Errore' :
                'Sync OK'
              }</span>
            </div>
          ) : (
            <div className="sync-status sync-notoken" style={{ fontSize: '0.7rem' }} onClick={() => setShowSettings(true)}>
              <CloudOff size={12} />
              <span>No sync</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop header (hidden on mobile via CSS) ── */}
      <header>
        <div className="title-area">
          <h1>Scadenziario</h1>
          {ghSettings.token ? (
            <div className={`sync-status sync-${syncStatus}`} title={
              syncStatus === 'saving' ? 'Salvataggio su GitHub...' :
              syncStatus === 'saved' ? 'Salvato su GitHub!' :
              syncStatus === 'error' ? 'Errore di salvataggio' :
              'Auto-salvataggio su GitHub attivo'
            }>
              {syncStatus === 'saving' && <div className="loading-spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#60a5fa' }} />}
              {syncStatus === 'saved' && <Check size={14} />}
              {syncStatus === 'error' && <CloudOff size={14} />}
              {syncStatus === 'idle' && <CloudUpload size={14} />}
              <span>{
                syncStatus === 'saving' ? 'Salvataggio...' :
                syncStatus === 'saved' ? 'Salvato!' :
                syncStatus === 'error' ? 'Errore sync' :
                'Auto-sync GitHub'
              }</span>
            </div>
          ) : (
            <div className="sync-status sync-notoken" title="Configura GitHub nelle impostazioni" onClick={() => setShowSettings(true)}>
              <CloudOff size={14} />
              <span>GitHub non configurato</span>
            </div>
          )}
        </div>
        <div className="controls">
          <button onClick={() => fetchData(authToken)} title="Ricarica dati da GitHub" disabled={loading}>
            <RefreshCw size={18} style={loading ? { animation: 'spin 1s linear infinite' } : {}} /> Ricarica
          </button>
          <button onClick={() => setShowSettings(true)}>
            <Settings size={18} /> Config
          </button>
          <button onClick={downloadDbJson} title="Scarica il file db.json aggiornato">
            <FileText size={18} /> Scarica db.json
          </button>
          <button onClick={exportExcel}>
            <Download size={18} /> Esporta Excel
          </button>
          <button className="logout-btn" onClick={handleLogout} title={`Disconnetti (${currentUser || 'Utente'})`}>
            <LogOut size={16} /> Esci
          </button>
        </div>
      </header>

      {/* Quick Stats & Filters */}
      <div className="stats-bar">
        <div 
          className={`stat-chip ${!filterDueOnly && !searchTerm ? 'active' : ''}`}
          onClick={() => { setFilterDueOnly(false); setSearchTerm(''); }}
        >
          <span>Tutte le utenze:</span>
          <strong>{data.length}</strong>
        </div>
        <div 
          className={`stat-chip danger ${filterDueOnly || sortConfig.key === 'dueAmount' ? 'active' : ''}`}
          onClick={() => {
            handleSort('dueAmount');
            showToast("Ordinato per Da Pagare (mostrati prima i valorizzati)");
          }}
          title="Clicca per ordinare per importi da pagare"
        >
          <DollarSign size={14} />
          <span>Da Pagare:</span>
          <strong>{dueCount}</strong>
        </div>
        <div 
          className="stat-chip warning"
          onClick={() => handleSort('expireDate')}
          title="Clicca per ordinare per scadenza"
        >
          <AlertCircle size={14} />
          <span>In Scadenza (7gg):</span>
          <strong style={{ color: '#fca5a5' }}>{expiringCount}</strong>
        </div>
      </div>

      {/* Gruppi Colorati Filter Bar */}
      <div className="group-filter-container">
        <div className="group-filter-header">
          <div className="group-filter-title">
            <Palette size={15} style={{ color: 'var(--accent)' }} />
            <span>Gruppi Utenti ({USER_GROUPS.length}):</span>
          </div>
          {selectedGroup && (
            <button 
              className="group-filter-clear" 
              onClick={() => setSelectedGroup(null)}
              title="Mostra tutti i gruppi"
            >
              <X size={13} /> Mostra tutti
            </button>
          )}
        </div>
        <div className="group-chips-scroll">
          <button
            className={`group-chip ${selectedGroup === null ? 'active' : ''}`}
            onClick={() => setSelectedGroup(null)}
          >
            <span>Tutti</span>
            <span className="chip-badge">{data.length}</span>
          </button>
          {USER_GROUPS.map(grp => {
            const count = groupCounts[grp.id] || 0;
            const isAct = selectedGroup === grp.id;
            return (
              <button
                key={grp.id}
                className={`group-chip ${isAct ? 'active' : ''}`}
                style={isAct ? { borderColor: grp.color, backgroundColor: grp.bg } : {}}
                onClick={() => setSelectedGroup(prev => prev === grp.id ? null : grp.id)}
                title={grp.label}
              >
                <span className="color-dot" style={{ backgroundColor: grp.color }} />
                <span>{grp.label}</span>
                <span className="chip-badge">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass-panel">
        <div className="panel-header">
          <div className="panel-header-title">
            <h2>Elenco Utenze</h2>
            <span className="panel-count-tag">{processedData.length}</span>
          </div>

          {/* View Mode Toggle */}
          <div className="view-mode-toggle">
            <button 
              className={`view-toggle-btn ${viewMode === 'compact' ? 'active' : ''}`}
              onClick={() => handleSetViewMode('compact')}
              title="Vista Tabella Compatta (adatta a smartphone senza scorrere a destra)"
            >
              <Table size={15} />
              <span className="toggle-text">Compatta</span>
            </button>
            <button 
              className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => handleSetViewMode('cards')}
              title="Vista a Schede"
            >
              <LayoutGrid size={15} />
              <span className="toggle-text">Schede</span>
            </button>
            <button 
              className={`view-toggle-btn ${viewMode === 'full' ? 'active' : ''}`}
              onClick={() => handleSetViewMode('full')}
              title="Vista Tabella Completa"
            >
              <Layers size={15} />
              <span className="toggle-text">Completa</span>
            </button>
          </div>

          <button className="primary add-btn-desktop" onClick={openAddModal}>
            <Plus size={18} /> Aggiungi Utenza
          </button>
        </div>

        {/* Search Bar */}
        <div className="search-box">
          <Search size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <input 
            type="text" 
            placeholder="Cerca per username, note, piano, importo..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="icon-btn" onClick={() => setSearchTerm('')} style={{ padding: '2px', border: 'none' }}>
              <X size={16} />
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Caricamento dati...</div>
        ) : (
          <div className="view-container">
            {viewMode === 'compact' && renderCompactTable()}
            {viewMode === 'cards' && renderCards()}
            {viewMode === 'full' && renderFullTable()}
          </div>
        )}
      </div>

      {/* Item Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingItem ? 'Modifica Utenza' : 'Nuova Utenza'}</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveItem}>
              <div className="form-group">
                <label>Username</label>
                <input name="username" defaultValue={editingItem?.username} required />
              </div>
              <div className="form-group">
                <label>Piano (quanto pagano)</label>
                <input name="plan" defaultValue={editingItem?.plan} />
              </div>
              <div className="form-group">
                <label>Data Scadenza</label>
                <input type="datetime-local" name="expireDate" defaultValue={editingItem?.expireDate ? editingItem.expireDate.slice(0, 16) : ''} required />
              </div>
              <div className="form-group">
                <label>Note</label>
                <textarea name="notes" defaultValue={editingItem?.notes} rows="2"></textarea>
              </div>
              <div className="form-group">
                <label>Tipo Lista (ex Crediti)</label>
                <input name="credits" defaultValue={editingItem?.credits} />
              </div>
              <div className="form-group">
                <label>Da Pagare (Avere)</label>
                <input name="dueAmount" defaultValue={editingItem?.dueAmount} />
              </div>
              <div className="form-group">
                <label>Gruppo Colorato (Excel)</label>
                <select 
                  name="group" 
                  defaultValue={editingItem ? (editingItem.group || getUserGroup(editingItem.username)?.id || '') : ''}
                  className="group-select"
                >
                  <option value="">-- Nessun Gruppo --</option>
                  {USER_GROUPS.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)}>Annulla</button>
                <button type="submit" className="primary">Salva Utenza</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Configurazione GitHub</h3>
              <button className="icon-btn" onClick={() => setShowSettings(false)}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Per permettere all'app di salvare i dati automaticamente su GitHub, inserisci un Personal Access Token. I dati resteranno solo sul tuo browser.
            </p>
            <form onSubmit={saveSettings}>
              <div className="form-group">
                <label>GitHub Personal Access Token</label>
                <input type="password" name="token" defaultValue={ghSettings.token} placeholder="ghp_..." />
              </div>
              <div className="form-group">
                <label>Repository (es. kilua83/scadenziario)</label>
                <input name="repo" defaultValue={ghSettings.repo} required />
              </div>
              <div className="form-group">
                <label>Percorso File JSON</label>
                <input name="path" defaultValue={ghSettings.path} required />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowSettings(false)}>Annulla</button>
                <button type="submit" className="primary">Salva Impostazioni</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.msg}
        </div>
      )}

      {/* ── FAB: Add entry (mobile only, via CSS) ── */}
      <button className="fab-add" onClick={openAddModal} title="Aggiungi Utenza">
        <Plus size={26} />
      </button>

      {/* ── Bottom Navigation Bar (mobile only) ── */}
      <nav className="bottom-nav">
        <button
          className={`bottom-nav-item${loading ? ' active' : ''}`}
          onClick={() => fetchData(authToken)}
          disabled={loading}
        >
          <RefreshCw size={22} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          <span>Ricarica</span>
        </button>
        <button
          className="bottom-nav-item"
          onClick={() => setShowSettings(true)}
        >
          <Settings size={22} />
          <span>Config</span>
        </button>
        <button
          className="bottom-nav-item"
          onClick={exportExcel}
        >
          <Download size={22} />
          <span>Excel</span>
        </button>
        <button
          className="bottom-nav-item"
          onClick={handleLogout}
        >
          <LogOut size={22} />
          <span>Esci</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
