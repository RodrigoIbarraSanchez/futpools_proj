import React, { useMemo, useState, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const apiFetch = async (path, options = {}, token) => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...options
  });
  const text = await res.text();
  let data = {};
  try {
    if (text) data = JSON.parse(text);
  } catch (_) {}
  if (!res.ok) {
    throw new Error(data?.message || "Request failed");
  }
  return data;
};

const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("fp_admin_token") || "");
  const [adminEmail, setAdminEmail] = useState("");

  const onLogout = () => {
    localStorage.removeItem("fp_admin_token");
    setToken("");
    setAdminEmail("");
  };

  return (
    <div className="app">
      {!token ? (
        <Login onLogin={(t, email) => {
          localStorage.setItem("fp_admin_token", t);
          setToken(t);
          setAdminEmail(email);
        }} />
      ) : (
        <Dashboard token={token} adminEmail={adminEmail} onLogout={onLogout} />
      )}
    </div>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("admin@futpools.app");
  const [password, setPassword] = useState("Password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      onLogin(data.token, data.admin?.email || email);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="brand">
          <span className="brand-dot" />
          <h1>Futpools Admin</h1>
          <p>Create Quinielas with live fixtures.</p>
        </div>
        <form onSubmit={submit} className="form">
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@futpools.app" />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="error">{error}</div>}
          <button className="btn primary" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ token, adminEmail, onLogout }) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [selectedFixtures, setSelectedFixtures] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prize, setPrize] = useState("");
  const [cost, setCost] = useState("");
  const [message, setMessage] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [saving, setSaving] = useState(false);

  const [existingQuinielas, setExistingQuinielas] = useState([]);
  const [loadingQuinielas, setLoadingQuinielas] = useState(false);
  const [editQuiniela, setEditQuiniela] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrize, setEditPrize] = useState("");
  const [editCost, setEditCost] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [bannerImageURL, setBannerImageURL] = useState("");
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("");

  const startDate = useMemo(() => {
    const dates = selectedFixtures
      .map((f) => new Date(f.date))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a - b);
    return dates[0] || null;
  }, [selectedFixtures]);

  const searchSources = async (rawQuery = query) => {
    const q = String(rawQuery || "").trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setLoadingSearch(true);
    setMessage("");
    try {
      const [leagues, teams] = await Promise.all([
        apiFetch(`/api/football/leagues/search?query=${encodeURIComponent(q)}`, {}, token),
        apiFetch(`/api/football/teams/search?query=${encodeURIComponent(q)}`, {}, token),
      ]);

      const leagueItems = (Array.isArray(leagues) ? leagues : []).map((l) => ({
        kind: "league",
        id: l.id,
        name: l.name,
        logo: l.logo,
        country: l.country,
        season: l.season,
      }));

      const teamItems = (Array.isArray(teams) ? teams : []).map((t) => ({
        kind: "team",
        id: t.id,
        name: t.name,
        logo: t.logo,
        country: t.country,
      }));

      setSearchResults([...leagueItems, ...teamItems]);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoadingSearch(false);
    }
  };

  const loadFixtures = async (source) => {
    setSelectedSource(source);
    setLoadingFixtures(true);
    setMessage("");
    try {
      const seasonQuery = source?.season ? `&season=${source.season}` : "";
      const path = source?.kind === "team"
        ? `/api/football/fixtures?teamId=${source.id}`
        : `/api/football/fixtures?leagueId=${source.id}${seasonQuery}`;
      const data = await apiFetch(path, {}, token);
      setFixtures(data);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoadingFixtures(false);
    }
  };

  const addFixture = (fixture) => {
    if (selectedFixtures.some((f) => f.fixtureId === fixture.fixtureId)) return;
    setSelectedFixtures((prev) => [...prev, fixture]);
  };

  const removeFixture = (fixtureId) => {
    setSelectedFixtures((prev) => prev.filter((f) => f.fixtureId !== fixtureId));
  };

  const loadQuinielas = async () => {
    setLoadingQuinielas(true);
    try {
      const list = await apiFetch("/api/quinielas", {}, token);
      setExistingQuinielas(Array.isArray(list) ? list : []);
    } catch (err) {
      setExistingQuinielas([]);
    } finally {
      setLoadingQuinielas(false);
    }
  };

  const saveQuiniela = async () => {
    setMessage("");
    if (!name || !prize || !cost || selectedFixtures.length === 0) {
      setMessage("Please fill all required fields and add at least one fixture.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        prize,
        cost,
        fixtures: selectedFixtures.map((f) => ({
          fixtureId: f.fixtureId,
          leagueId: f.league?.id,
          leagueName: f.league?.name || "",
          homeTeamId: f.teams?.home?.id,
          awayTeamId: f.teams?.away?.id,
          homeTeam: f.teams?.home?.name,
          awayTeam: f.teams?.away?.name,
          homeLogo: f.teams?.home?.logo,
          awayLogo: f.teams?.away?.logo,
          kickoff: f.date,
          status: f.status || ""
        }))
      };
      await apiFetch("/api/quinielas", { method: "POST", body: JSON.stringify(payload) }, token);
      setMessage("Quiniela saved successfully.");
      setSelectedFixtures([]);
      setName("");
      setDescription("");
      setPrize("");
      setCost("");
      loadQuinielas();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (q) => {
    setEditQuiniela(q);
    setEditName(q.name || "");
    setEditDescription(q.description || "");
    setEditPrize(q.prize || "");
    setEditCost(q.cost || "");
  };

  const saveEdit = async () => {
    if (!editQuiniela) return;
    setSavingEdit(true);
    try {
      await apiFetch(`/api/quinielas/${editQuiniela._id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          prize: editPrize,
          cost: editCost
        })
      }, token);
      setEditQuiniela(null);
      loadQuinielas();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    setMessage("");
    try {
      await apiFetch(`/api/quinielas/${deleteId}`, { method: "DELETE" }, token);
      setDeleteId(null);
      loadQuinielas();
    } catch (err) {
      // 404 = already deleted (e.g. by app via main backend); treat as success
      const is404 = err.message?.toLowerCase().includes("not found") || err.message?.toLowerCase().includes("404");
      if (is404) {
        setDeleteId(null);
        loadQuinielas();
      } else {
        setMessage(err.message);
      }
    } finally {
      setDeleting(false);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await apiFetch("/api/settings", {}, token);
      setBannerImageURL(data?.bannerImageURL || "");
    } catch {
      setBannerImageURL("");
    }
  };

  const saveBanner = async () => {
    setBannerMessage("");
    setBannerSaving(true);
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ bannerImageURL: bannerImageURL.trim() || null }),
      }, token);
      setBannerMessage("Banner URL saved. The app will show it on next refresh.");
    } catch (err) {
      setBannerMessage(err.message);
    } finally {
      setBannerSaving(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadQuinielas();
      loadSettings();
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchSources(q);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, token]);

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <h2>Quiniela Builder</h2>
          <p>Create and publish matchdays with real fixtures.</p>
        </div>
        <div className="topbar-actions">
          <span className="pill">{adminEmail || "Admin"}</span>
          <button className="btn ghost" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <div className="grid">
        <section className="panel panel-full">
          <h3>App banner (iOS home)</h3>
          <p className="panel-hint">Image URL shown at the top of the Pools screen. Use 1200×400 px (3:1) for best results. Change anytime; the app loads it on refresh.</p>
          <div className="search-row">
            <input
              type="url"
              value={bannerImageURL}
              onChange={(e) => setBannerImageURL(e.target.value)}
              placeholder="https://example.com/banner.jpg"
            />
            <button className="btn" onClick={saveBanner} disabled={bannerSaving}>
              {bannerSaving ? "Saving..." : "Save URL"}
            </button>
          </div>
          {bannerMessage && <div className={bannerMessage.startsWith("Banner") ? "message success" : "message"}>{bannerMessage}</div>}
        </section>
        <section className="panel panel-full">
          <h3>Existing Quinielas</h3>
          {loadingQuinielas && <div className="empty">Loading...</div>}
          {!loadingQuinielas && existingQuinielas.length === 0 && (
            <div className="empty">No quinielas yet. Create one below.</div>
          )}
          {!loadingQuinielas && existingQuinielas.length > 0 && (
            <div className="quiniela-list">
              {existingQuinielas.map((q) => (
                <div key={q._id} className="quiniela-row">
                  <div className="quiniela-info">
                    <strong>{q.name}</strong>
                    <span className="quiniela-meta">
                      {q.prize} · {q.cost} · {q.fixtures?.length ?? 0} fixtures
                      {q.startDate && ` · ${formatDate(q.startDate)}`}
                    </span>
                  </div>
                  <div className="quiniela-actions">
                    <button type="button" className="btn small" onClick={() => openEdit(q)}>Edit</button>
                    <button type="button" className="btn ghost small danger" onClick={() => setDeleteId(q._id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <h3>League + Team Search</h3>
          <div className="search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search leagues or teams (e.g. Liga MX, América)"
            />
          </div>
          <div className="results">
            {searchResults.map((item) => (
              <button key={`${item.kind}-${item.id}`} className={`result ${selectedSource?.kind === item.kind && selectedSource?.id === item.id ? "active" : ""}`} onClick={() => loadFixtures(item)}>
                <img src={item.logo} alt={item.name} />
                <div>
                  <div className="result-name">{item.name}</div>
                  <div className="result-meta">
                    {item.kind === "league" ? "League" : "Team"}
                    {item.country ? ` · ${item.country}` : ""}
                    {item.season ? ` · ${item.season}` : ""}
                  </div>
                </div>
              </button>
            ))}
            {loadingSearch && <div className="empty">Searching...</div>}
            {!loadingSearch && !searchResults.length && <div className="empty">Type to search leagues and teams.</div>}
          </div>
        </section>

        <section className="panel">
          <h3>Live & Upcoming Fixtures</h3>
          {selectedSource && (
            <div className="subtitle">Showing fixtures for {selectedSource.name}</div>
          )}
          <div className="fixtures">
            {loadingFixtures && <div className="empty">Loading fixtures...</div>}
            {!loadingFixtures && fixtures.map((f) => (
              <div key={f.fixtureId} className="fixture">
                <div className="fixture-teams">
                  <img src={f.teams?.home?.logo} alt={f.teams?.home?.name} />
                  <div>{f.teams?.home?.name}</div>
                  <span>vs</span>
                  <div>{f.teams?.away?.name}</div>
                  <img src={f.teams?.away?.logo} alt={f.teams?.away?.name} />
                </div>
                <div className="fixture-meta">
                  <div>{f.league?.name}</div>
                  <div>{f.status ? `${f.status} · ${formatDate(f.date)}` : formatDate(f.date)}</div>
                </div>
                <button className="btn small" onClick={() => addFixture(f)}>Add</button>
              </div>
            ))}
            {!loadingFixtures && selectedSource && fixtures.length === 0 && (
              <div className="empty">No live or upcoming fixtures found.</div>
            )}
          </div>
        </section>

        <section className="panel">
          <h3>Quiniela Details</h3>
          <div className="form">
            <label>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Week 1 Special" />
            <label>Description</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description..." />
            <div className="row">
              <div>
                <label>Prize *</label>
                <input value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="$5000" />
              </div>
              <div>
                <label>Cost *</label>
                <input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="$5" />
              </div>
            </div>
            <label>Start Date</label>
            <input value={startDate ? formatDate(startDate.toISOString()) : "—"} readOnly />
          </div>
        </section>

        <section className="panel">
          <h3>Selected Fixtures</h3>
          <div className="selected">
            {selectedFixtures.map((f) => (
              <div key={f.fixtureId} className="fixture compact">
                <div className="fixture-teams">
                  <img src={f.teams?.home?.logo} alt={f.teams?.home?.name} />
                  <div>{f.teams?.home?.name}</div>
                  <span>vs</span>
                  <div>{f.teams?.away?.name}</div>
                  <img src={f.teams?.away?.logo} alt={f.teams?.away?.name} />
                </div>
                <div className="fixture-meta">
                  <div>{formatDate(f.date)}</div>
                </div>
                <button className="btn ghost small" onClick={() => removeFixture(f.fixtureId)}>Remove</button>
              </div>
            ))}
            {!selectedFixtures.length && <div className="empty">No fixtures selected.</div>}
          </div>
          {message && <div className="message">{message}</div>}
          <button className="btn primary wide" onClick={saveQuiniela} disabled={saving}>
            {saving ? "Saving..." : "Save Quiniela"}
          </button>
        </section>
      </div>

      {editQuiniela && (
        <div className="modal-overlay" onClick={() => setEditQuiniela(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Quiniela</h3>
            <div className="form">
              <label>Name *</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
              <label>Description</label>
              <textarea rows={2} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description" />
              <div className="row">
                <div>
                  <label>Prize *</label>
                  <input value={editPrize} onChange={(e) => setEditPrize(e.target.value)} placeholder="$5000" />
                </div>
                <div>
                  <label>Cost *</label>
                  <input value={editCost} onChange={(e) => setEditCost(e.target.value)} placeholder="$5" />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setEditQuiniela(null)}>Cancel</button>
              <button type="button" className="btn primary" onClick={saveEdit} disabled={savingEdit || !editName.trim() || !editPrize.trim() || !editCost.trim()}>
                {savingEdit ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Quiniela</h3>
            <p>Are you sure you want to delete this quiniela? This cannot be undone.</p>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button type="button" className="btn danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
