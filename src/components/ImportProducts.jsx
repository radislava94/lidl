import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useApp } from '../store/AppContext';
import {
  SUPPORTED_EXTENSIONS,
  parseFile,
  rowsToProducts,
  validateAndBuild,
  applyMergeStrategy,
  exportToExcel,
  exportToCSV,
  exportToJSON,
  downloadTemplate,
} from '../utils/importExcel';
import { CATEGORY_META } from '../utils/dataLoader';

// ─── Merge strategy options ───────────────────────────────────────────────────
const STRATEGIES = [
  { value: 'replace', label: 'Replace entire database',    icon: 'fa-sync-alt',   desc: 'All existing products are removed and replaced.' },
  { value: 'merge',   label: 'Merge (add new only)',        icon: 'fa-code-branch', desc: 'Existing products kept; only new PLUs are added.' },
  { value: 'update',  label: 'Update existing products',    icon: 'fa-pen',        desc: 'New file overwrites matching PLUs, keeps others.' },
  { value: 'preview', label: 'Preview only (no changes)',   icon: 'fa-eye',        desc: 'See results without modifying anything.' },
];

// ─── Small helper: category badge ────────────────────────────────────────────
function CatBadge({ cat }) {
  const meta = CATEGORY_META[cat] || { name: cat, emoji: '📦', color: '#64748b' };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
      style={{ background: meta.color }}
    >
      {meta.emoji} {meta.name}
    </span>
  );
}

export default function ImportProducts() {
  const { state, dispatch } = useApp();

  // ── File / parse state ────────────────────────────────────────────────────
  const [file, setFile]               = useState(null);
  const [parseError, setParseError]   = useState('');
  const [parsed, setParsed]           = useState(null);        // { products: valid[], report }
  const [strategy, setStrategy]       = useState('merge');
  const [isProcessing, setProcessing] = useState(false);
  const [progress, setProgress]       = useState(0);
  const [importDone, setImportDone]   = useState(false);

  // preview table filter
  const [search, setSearch]           = useState('');
  const [filterCat, setFilterCat]     = useState('all');

  // ── Dropzone ──────────────────────────────────────────────────────────────
  const onDrop = useCallback(async (acceptedFiles) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setParseError('');
    setParsed(null);
    setImportDone(false);
    setProgress(10);

    try {
      const ext = f.name.split('.').pop().toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(`.${ext}`)) {
        throw new Error(`Unsupported file type ".${ext}". Please use .xlsx, .xls, or .csv`);
      }

      setProgress(30);
      const rows = await parseFile(f);
      setProgress(60);

      const { products: dataRows, colMap, errors } = rowsToProducts(rows);
      if (errors.length) throw new Error(errors.join('\n'));

      setProgress(80);
      const { valid, report } = validateAndBuild(dataRows, colMap, state.products);
      setProgress(100);
      setParsed({ valid, report });
    } catch (err) {
      setParseError(err.message);
      setProgress(0);
    }
  }, [state.products]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
  });

  // ── Import action ─────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!parsed || strategy === 'preview') return;
    setProcessing(true);
    setProgress(0);

    // Simulate progressive steps for UX
    for (let p = 0; p <= 80; p += 20) {
      await new Promise(r => setTimeout(r, 80));
      setProgress(p);
    }

    const finalProducts = applyMergeStrategy(strategy, parsed.valid, state.products);
    dispatch({ type: 'SET_PRODUCTS', products: finalProducts });

    setProgress(100);
    setProcessing(false);
    setImportDone(true);
  };

  // ── Filtered preview ──────────────────────────────────────────────────────
  const previewProducts = parsed?.valid.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.plu.includes(search);
    const matchCat = filterCat === 'all' || p.category === filterCat;
    return matchSearch && matchCat;
  }) ?? [];

  const uniqueCats = parsed ? [...new Set(parsed.valid.map(p => p.category))] : [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <i className="fa fa-file-excel" style={{ color: '#22c55e', marginRight: 8 }} />
          Import Products
        </h1>
        <p className="page-subtitle">Upload an Excel or CSV file to update the product database</p>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Upload Card ──────────────────────────────────────────────── */}
        <div className="card">
          <h2 className="section-title" style={{ marginBottom: 16 }}>
            <i className="fa fa-upload" style={{ marginRight: 8 }} /> Upload File
          </h2>

          <div
            {...getRootProps()}
            style={{
              border: `2px dashed ${isDragActive ? '#e3000f' : 'var(--border)'}`,
              borderRadius: 12,
              padding: '40px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragActive ? 'rgba(227,0,15,0.05)' : 'var(--bg-secondary)',
              transition: 'all 0.2s',
            }}
          >
            <input {...getInputProps()} />
            <i className="fa fa-cloud-upload-alt" style={{ fontSize: 40, color: isDragActive ? '#e3000f' : 'var(--text-muted)', marginBottom: 12, display: 'block' }} />
            {isDragActive ? (
              <p style={{ color: '#e3000f', fontWeight: 600 }}>Drop the file here…</p>
            ) : (
              <>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>Drag & drop your file here</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>or click to browse</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>Supports: .xlsx  .xls  .csv</p>
              </>
            )}
          </div>

          {/* File info */}
          {file && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <i className="fa fa-file-excel" style={{ color: '#22c55e', fontSize: 20 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{file.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB</div>
              </div>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: 12 }}
                onClick={() => { setFile(null); setParsed(null); setParseError(''); setProgress(0); setImportDone(false); }}
              >
                <i className="fa fa-times" /> Clear
              </button>
            </div>
          )}

          {/* Progress bar */}
          {progress > 0 && progress < 100 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: '#e3000f', borderRadius: 99, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Processing… {progress}%</div>
            </div>
          )}

          {/* Error */}
          {parseError && (
            <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444' }}>
              <i className="fa fa-exclamation-triangle" style={{ marginRight: 6 }} />
              {parseError}
            </div>
          )}

          {/* Success animation */}
          {importDone && (
            <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fa fa-check-circle" style={{ fontSize: 20 }} />
              <div>
                <div style={{ fontWeight: 600 }}>Import complete!</div>
                <div style={{ fontSize: 13 }}>
                  {parsed.valid.length} products are now live across all app features.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Validation Report ────────────────────────────────────────── */}
        {parsed && (
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 16 }}>
              <i className="fa fa-clipboard-check" style={{ marginRight: 8 }} /> Validation Report
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <ReportBadge icon="fa-check-circle" color="#22c55e" label="Valid" value={parsed.report.valid} />
              <ReportBadge icon="fa-copy"         color="#f59e0b" label="Duplicates" value={parsed.report.duplicates} />
              <ReportBadge icon="fa-exclamation"  color="#ef4444" label="Invalid rows" value={parsed.report.invalidRows} />
              <ReportBadge icon="fa-minus-circle" color="#94a3b8" label="Empty rows" value={parsed.report.emptyRows} />
              <ReportBadge icon="fa-list"         color="#6366f1" label="Total rows" value={parsed.report.total} />
            </div>

            {parsed.report.details.length > 0 && (
              <details style={{ marginTop: 14 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', userSelect: 'none' }}>
                  Show {parsed.report.details.length} issue(s)
                </summary>
                <div style={{ marginTop: 8, maxHeight: 160, overflowY: 'auto', fontSize: 12 }}>
                  {parsed.report.details.map((d, i) => (
                    <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>Row {d.line}</span>: {d.issue} — {d.row}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* ── Import Strategy ──────────────────────────────────────────── */}
        {parsed && (
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 16 }}>
              <i className="fa fa-sliders-h" style={{ marginRight: 8 }} /> Import Options
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {STRATEGIES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStrategy(s.value)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: `2px solid ${strategy === s.value ? '#e3000f' : 'var(--border)'}`,
                    background: strategy === s.value ? 'rgba(227,0,15,0.06)' : 'var(--bg-secondary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, marginBottom: 4, color: strategy === s.value ? '#e3000f' : 'var(--text)' }}>
                    <i className={`fa ${s.icon}`} />
                    {s.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.desc}</div>
                </button>
              ))}
            </div>

            {/* Import button */}
            <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
              <button
                type="button"
                className="btn-primary"
                style={{ minWidth: 160, opacity: strategy === 'preview' ? 0.5 : 1 }}
                onClick={handleImport}
                disabled={isProcessing || strategy === 'preview'}
              >
                {isProcessing
                  ? <><i className="fa fa-spinner fa-spin" style={{ marginRight: 6 }} />Importing…</>
                  : <><i className="fa fa-file-import" style={{ marginRight: 6 }} />Import {parsed.valid.length} Products</>
                }
              </button>
            </div>

            {/* Import progress */}
            {isProcessing && (
              <div style={{ marginTop: 12 }}>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: '#e3000f', borderRadius: 99, transition: 'width 0.3s' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Preview Table ────────────────────────────────────────────── */}
        {parsed && parsed.valid.length > 0 && (
          <div className="card">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <h2 className="section-title" style={{ margin: 0 }}>
                <i className="fa fa-table" style={{ marginRight: 8 }} /> Preview ({parsed.valid.length} products)
              </h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search PLU or name…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ maxWidth: 200 }}
                />
                <select
                  className="search-input"
                  value={filterCat}
                  onChange={e => setFilterCat(e.target.value)}
                  style={{ maxWidth: 160 }}
                >
                  <option value="all">All categories</option>
                  {uniqueCats.map(c => (
                    <option key={c} value={c}>{CATEGORY_META[c]?.name || c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 1 }}>
                    <th style={thStyle}>PLU</th>
                    <th style={thStyle}>Product Name</th>
                    <th style={thStyle}>Name (EN)</th>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Difficulty</th>
                  </tr>
                </thead>
                <tbody>
                  {previewProducts.map((p, i) => (
                    <tr key={p.plu} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                      <td style={tdStyle}><code style={{ fontWeight: 700 }}>{p.plu}</code></td>
                      <td style={tdStyle}>{p.emoji} {p.name}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{p.nameEn}</td>
                      <td style={tdStyle}><CatBadge cat={p.category} /></td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{p.difficulty}</td>
                    </tr>
                  ))}
                  {previewProducts.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>No results match your filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Export / Template ────────────────────────────────────────── */}
        <div className="card">
          <h2 className="section-title" style={{ marginBottom: 16 }}>
            <i className="fa fa-download" style={{ marginRight: 8 }} /> Export & Templates
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <ExportButton icon="fa-file-excel"    color="#22c55e" label="Export Excel"    onClick={() => exportToExcel(state.products)} disabled={!state.products.length} />
            <ExportButton icon="fa-file-csv"      color="#6366f1" label="Export CSV"      onClick={() => exportToCSV(state.products)}   disabled={!state.products.length} />
            <ExportButton icon="fa-file-code"     color="#f59e0b" label="Export JSON"     onClick={() => exportToJSON(state.products)}   disabled={!state.products.length} />
            <ExportButton icon="fa-file-download" color="#06b6d4" label="Download Template" onClick={downloadTemplate} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
            Download the template to see the correct column format before importing.
          </p>
        </div>

        {/* ── Expected Format ───────────────────────────────────────────── */}
        <div className="card">
          <h2 className="section-title" style={{ marginBottom: 12 }}>
            <i className="fa fa-info-circle" style={{ marginRight: 8 }} /> Expected File Format
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            The importer auto-detects column names. Supported column headers:
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <th style={thStyle}>Column</th>
                  <th style={thStyle}>Required</th>
                  <th style={thStyle}>Accepted names</th>
                  <th style={thStyle}>Example</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['PLU', '✓', 'PLU, Код, Номер, Code, ID', '1'],
                  ['Name', '✓', 'Name, Продукт, Наименование, Артикул', 'Банани'],
                  ['Category', '', 'Category, Категория, Group', 'fruits'],
                  ['Name (EN)', '', 'NameEN, English Name, Eng', 'Bananas'],
                  ['Difficulty', '', 'Difficulty, Трудност', 'easy'],
                  ['Emoji', '', 'Emoji, Икона', '🍌'],
                ].map(([col, req, names, ex]) => (
                  <tr key={col}>
                    <td style={tdStyle}><strong>{col}</strong></td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: req ? '#22c55e' : 'var(--text-muted)' }}>{req || '–'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{names}</td>
                    <td style={tdStyle}><code>{ex}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Mini components ──────────────────────────────────────────────────────────
function ReportBadge({ icon, color, label, value }) {
  return (
    <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <i className={`fa ${icon}`} style={{ color, fontSize: 22 }} />
      <div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
      </div>
    </div>
  );
}

function ExportButton({ icon, color, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '9px 16px', borderRadius: 8, border: `1px solid ${color}`,
        background: 'transparent', color, fontWeight: 600, fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = color + '15'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <i className={`fa ${icon}`} /> {label}
    </button>
  );
}

// ─── Table styles ─────────────────────────────────────────────────────────────
const thStyle = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border)',
};

const tdStyle = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--border)',
};
