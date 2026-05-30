import { useState } from 'react';
import { useApp }  from '../store/AppContext';

export default function Mistakes() {
  const { state, actions } = useApp();
  const [confirmClear, setConfirmClear] = useState(false);

  // Sort by mistake count descending
  const mistakeList = Object.entries(state.mistakes)
    .sort(([, a], [, b]) => b - a)
    .map(([plu, count]) => {
      const product = state.products.find(p => String(p.plu) === String(plu));
      return { plu, count, product };
    });

  const total = mistakeList.reduce((s, m) => s + m.count, 0);

  if (!mistakeList.length) {
    return (
      <div className="page active">
        <div className="page-header">
          <h2 className="page-title"><i className="fa fa-bug" /> Mistakes</h2>
          <p className="page-sub">Items you've answered incorrectly</p>
        </div>
        <div className="empty-state">
          <div style={{ fontSize: '4rem', marginBottom: 12 }}>🎉</div>
          <h3>No mistakes yet!</h3>
          <p>You're doing great — keep practising to see your errors here.</p>
          <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => actions.setPage('quiz')}>
            <i className="fa fa-brain" /> Start a Quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page active">
      <div className="page-header">
        <h2 className="page-title"><i className="fa fa-bug" /> Mistakes</h2>
        <p className="page-sub">{mistakeList.length} items · {total} total errors</p>
      </div>

      {/* Actions */}
      <div className="section-actions">
        <button className="btn-primary" onClick={() => actions.setPage('quiz')}>
          <i className="fa fa-brain" /> Quiz my mistakes
        </button>
        {!confirmClear ? (
          <button className="btn-outline" onClick={() => setConfirmClear(true)}>
            <i className="fa fa-trash" /> Clear all
          </button>
        ) : (
          <div className="confirm-row">
            <span>Are you sure?</span>
            <button className="btn-red btn-sm" onClick={() => { actions.clearMistakes(); setConfirmClear(false); }}>
              Yes, clear
            </button>
            <button className="btn-outline btn-sm" onClick={() => setConfirmClear(false)}>Cancel</button>
          </div>
        )}
      </div>

      {/* List */}
      <div className="mistakes-list">
        {mistakeList.map(({ plu, count, product }) => (
          <div key={plu} className="mistake-row">
            <div className="mistake-emoji">{product?.emoji ?? '❓'}</div>
            <div className="mistake-info">
              <div className="mistake-name">{product?.name ?? `PLU ${plu}`}</div>
              <div className="mistake-meta">
                PLU: <strong>{plu}</strong>
                {product && <span className={`diff-badge ${product.difficulty}`} style={{ marginLeft: 8 }}>
                  {product.difficulty}
                </span>}
              </div>
            </div>
            <div className="mistake-count">
              <span className="count-badge">{count}×</span>
            </div>
            <button
              className="btn-icon"
              title="Dismiss"
              onClick={() => actions.removeMistake(plu)}
              aria-label={`Remove ${product?.name ?? plu} from mistakes`}
            >
              <i className="fa fa-times" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
