import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Settings, Download, Plus, Edit2, Trash2, X, ArrowUpDown, ArrowUp, ArrowDown, FileText, Search, DollarSign, AlertCircle, CloudOff, CloudUpload, Check, Lock, LogOut, User, RefreshCw } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import { login, getSessionToken, getSessionUser, logout } from './auth';
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
  }, [data, sortConfig, searchTerm, filterDueOnly]);

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
      remaining: formData.get('remaining')
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

  return (
    <div className="app-container">
      <header>
        <div className="title-area">
          <h1>Scadenziario</h1>
          {/* Cloud sync status indicator */}
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

      <div className="glass-panel">
        <div className="panel-header">
          <h2>Elenco Utenze</h2>
          <button className="primary" onClick={openAddModal}>
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
                  return (
                    <tr key={item.id || index} className={expiring ? 'expiring' : ''}>
                      <td style={{ fontWeight: 600 }}>{item.username}</td>
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
    </div>
  );
}

export default App;
