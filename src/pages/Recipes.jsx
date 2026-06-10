import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getPantryItems, addShoppingItem } from '../lib/supabaseStorage';
import { usePantry } from '../contexts/PantryContext';
import { getRecipeSuggestions, getAIRecipeSuggestions } from '../lib/recipes';
import { getExpirationStatus, getDaysUntilExpiration } from '../lib/helpers';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { useToast } from '../components/ToastContext';
import './Recipes.css';

// Debounce so a flurry of realtime updates (e.g. importing 10 receipt items)
// doesn't fire 10 AI calls in a row.
const AI_DEBOUNCE_MS = 1200;

export default function Recipes() {
  const { activePantry } = usePantry();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [aiRecipes, setAiRecipes] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  // aiError is now an object: null | { code, message, resetLabel? }
  const [aiError, setAiError] = useState(null);
  const { showToast } = useToast();
  const aiRequestId = useRef(0);
  const fetchSeqRef = useRef(0);
  const aiDebounceRef = useRef(null);

  const fetchItems = useCallback(async () => {
    if (!activePantry) return;
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    try {
      const data = await getPantryItems(activePantry.id);
      if (seq !== fetchSeqRef.current) return;
      setItems(data);
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      console.error('Failed to load items for recipes', err);
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [activePantry]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useRealtimeSync(activePantry?.id, 'pantry_items', fetchItems);

  // Local recipe suggestions (instant)
  const localSuggestions = useMemo(() => getRecipeSuggestions(items), [items]);

  // Run an AI fetch immediately (used by the retry button).
  // Show the "fell back to free tier" toast only once per session — if the
  // user's key is consistently bad, we don't want to nag them every refresh.
  const hasShownFallbackToastRef = useRef(false);

  // Signature of the item set the last AI fetch ran against. Realtime events
  // and pantry refreshes produce a new `items` array identity even when
  // nothing changed — without this guard every refresh burned a rate-limit
  // token and a Gemini call for identical results.
  const lastAISignatureRef = useRef(null);

  const itemsSignature = (list) =>
    list
      .map((i) => `${i.name}|${i.quantity}|${i.expirationDate || ''}`)
      .sort()
      .join('~');

  const fetchAINow = useCallback((force = false) => {
    if (items.length === 0) {
      setAiRecipes(null);
      lastAISignatureRef.current = null;
      return;
    }

    const signature = itemsSignature(items);
    if (!force && signature === lastAISignatureRef.current) return;
    lastAISignatureRef.current = signature;

    const requestId = ++aiRequestId.current;
    setAiLoading(true);
    setAiError(null);

    getAIRecipeSuggestions(items)
      .then((result) => {
        if (aiRequestId.current !== requestId) return;
        setAiRecipes(result.recipes);

        if (result.fellBack && !hasShownFallbackToastRef.current) {
          hasShownFallbackToastRef.current = true;
          showToast('Your key didn\'t work — using free tier. Update key in Settings.', 'info', { duration: 6000 });
        }
      })
      .catch((err) => {
        if (aiRequestId.current !== requestId) return;
        console.error('AI recipe error:', err);
        setAiError({
          code: err.code || 'GEMINI_ERROR',
          message: err.message || 'AI suggestions are unavailable right now.',
          resetLabel: err.resetLabel,
          tier: err.tier,
          retryDelaySeconds: err.retryDelaySeconds,
        });
      })
      .finally(() => {
        if (aiRequestId.current === requestId) setAiLoading(false);
      });
  }, [items, showToast]);

  // Debounced trigger so rapid pantry changes don't fire back-to-back AI calls.
  const fetchAI = useCallback(() => {
    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    aiDebounceRef.current = setTimeout(() => {
      fetchAINow();
    }, AI_DEBOUNCE_MS);
  }, [fetchAINow]);

  useEffect(() => {
    fetchAI();
    return () => {
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    };
  }, [fetchAI]);

  // Use AI recipes if available, otherwise local
  const suggestions = aiRecipes && aiRecipes.length > 0 ? aiRecipes : localSuggestions;
  const isUsingAI = aiRecipes && aiRecipes.length > 0;

  // Items expiring soonest
  const expiringItems = useMemo(() => {
    return items
      .filter((i) => i.expirationDate && getExpirationStatus(i.expirationDate) === 'soon')
      .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate))
      .slice(0, 5);
  }, [items]);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleAddMissing = async (e, recipe) => {
    e.stopPropagation();
    if (recipe.missing.length === 0 || !activePantry) return;

    // Don't skip duplicate check — clicking twice would otherwise pile up dupes.
    // Inspect each result so the toast reflects what actually happened.
    const results = await Promise.allSettled(
      recipe.missing.map((ingredient) =>
        addShoppingItem(activePantry.id, { name: ingredient, quantity: 1, unit: 'pcs' })
      )
    );

    let added = 0;
    let alreadyOnList = 0;
    let failed = 0;
    for (const r of results) {
      if (r.status === 'fulfilled') {
        added++;
      } else if (r.reason?.code === 'DUPLICATE_ITEM') {
        alreadyOnList++;
      } else {
        failed++;
        console.error('Failed to add ingredient to shopping list:', r.reason);
      }
    }

    if (added === 0 && alreadyOnList > 0 && failed === 0) {
      showToast('All ingredients are already on your list');
    } else if (added === 0 && failed > 0) {
      showToast('Could not add ingredients — please try again', 'error');
    } else if (failed > 0) {
      showToast(`${added} added, ${failed} failed`, 'info');
    } else if (alreadyOnList > 0) {
      showToast(`${added} added · ${alreadyOnList} already on list`);
    } else {
      showToast(`${added} item${added !== 1 ? 's' : ''} added to shopping list`);
    }
  };

  return (
    <div className="page-content app-container">
      <div className="recipes-header animate-fade-in">
        <h2 className="page-title">Recipes</h2>
        <p className="page-subtitle">
          {isUsingAI ? '✨ AI-powered suggestions based on your pantry' : 'Dishes you can make with what you have'}
        </p>
      </div>

      {/* AI Loading Indicator */}
      {aiLoading && !isUsingAI && (
        <div className="ai-loading-banner animate-fade-in">
          <div className="ai-loading-pulse" />
          <span>Generating personalized recipes with AI...</span>
        </div>
      )}

      {/* AI Error — different copy per error code */}
      {aiError && !isUsingAI && !aiLoading && (() => {
        if (aiError.code === 'NO_API_KEY') {
          return (
            <Link to="/settings" className="ai-retry-banner animate-fade-in" style={{ display: 'flex', textDecoration: 'none' }}>
              <span>Add your Gemini API key in Settings to enable AI recipes.</span>
            </Link>
          );
        }
        if (aiError.code === 'RATE_LIMITED') {
          return (
            <div className="ai-retry-banner animate-fade-in" style={{ cursor: 'default' }}>
              <span>AI cooled down — try again in {aiError.resetLabel || 'a bit'}. Showing local recipes.</span>
            </div>
          );
        }
        if (aiError.code === 'GEMINI_RATE_LIMIT') {
          // Google's server-side throttle (distinct from our local limiter).
          // Most common reason: free-tier daily quota on the active key.
          const wait = aiError.retryDelaySeconds
            ? `Try again in ${aiError.retryDelaySeconds}s`
            : 'Try again in a moment';
          return (
            <button className="ai-retry-banner animate-fade-in" onClick={() => fetchAINow(true)}>
              <span>Google throttled the request. {wait}, or add your own key in Settings for more headroom.</span>
            </button>
          );
        }
        if (aiError.code === 'GEMINI_BAD_KEY') {
          return (
            <Link to="/settings" className="ai-retry-banner animate-fade-in" style={{ display: 'flex', textDecoration: 'none' }}>
              <span>Gemini rejected the key — open Settings to update it.</span>
            </Link>
          );
        }
        return (
          <button className="ai-retry-banner animate-fade-in" onClick={() => fetchAINow(true)}>
            <span>AI suggestions unavailable — showing local recipes. Tap to retry.</span>
          </button>
        );
      })()}

      {/* Expiring Soon Banner */}
      {expiringItems.length > 0 && (
        <div className="expiring-banner animate-fade-in">
          <div className="expiring-banner-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Use soon</span>
          </div>
          <div className="expiring-banner-items">
            {expiringItems.map((item) => (
              <span key={item.id} className="expiring-banner-chip">
                {item.name}
                <span className="expiring-banner-days">
                  {getDaysUntilExpiration(item.expirationDate)}d
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recipe Cards */}
      <div className="recipes-list">
        {suggestions.length > 0 ? (
          suggestions.map((recipe) => {
            const isExpanded = expandedId === recipe.id;
            const matchPct = Math.round((recipe.matchRatio || 0) * 100);
            return (
              <div
                key={recipe.id}
                className={`recipe-card card animate-fade-in ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleExpand(recipe.id)}
              >
                <div className="recipe-card-top">
                  <div className="recipe-card-info">
                    <h3 className="recipe-card-title">
                      {recipe.isAI && <span style={{ marginRight: '6px', fontSize: '0.9em' }}>✨</span>}
                      {recipe.title}
                    </h3>
                    <div className="recipe-card-meta">
                      <span className="recipe-meta-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {recipe.time}
                      </span>
                      <span className="recipe-meta-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                        </svg>
                        {recipe.servings}
                      </span>
                      <span className="recipe-meta-item recipe-difficulty">{recipe.difficulty}</span>
                    </div>
                  </div>
                  <div className="recipe-match-ring">
                    <svg viewBox="0 0 36 36" className="recipe-match-svg">
                      <path
                        className="recipe-match-bg"
                        d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
                        fill="none"
                        strokeWidth="3"
                      />
                      <path
                        className="recipe-match-fill"
                        d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
                        fill="none"
                        strokeWidth="3"
                        strokeDasharray={`${matchPct}, 100`}
                      />
                    </svg>
                    <span className="recipe-match-text">{matchPct}%</span>
                  </div>
                </div>

                {/* Ingredient Tags */}
                <div className="recipe-ingredients">
                  {(recipe.matched || []).map((ing) => (
                    <span key={ing} className="recipe-ing-tag have">{ing}</span>
                  ))}
                  {(recipe.missing || []).map((ing) => (
                    <span key={ing} className="recipe-ing-tag missing">{ing}</span>
                  ))}
                </div>

                {/* Add Missing to Shopping List */}
                {recipe.missing && recipe.missing.length > 0 && (
                  <button
                    className="btn btn-secondary recipe-add-missing"
                    onClick={(e) => handleAddMissing(e, recipe)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="21" r="1" />
                      <circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                    Add {recipe.missing.length} missing to list
                  </button>
                )}

                {/* Expanded: Instructions */}
                {isExpanded && (
                  <div className="recipe-instructions animate-fade-in">
                    <h4>Instructions</h4>
                    <ol>
                      {(recipe.instructions || []).map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="recipe-card-expand-hint">
                  {isExpanded ? 'Tap to collapse' : 'Tap for instructions'}
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state animate-fade-in">
            <div className="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <h3>No recipe matches</h3>
            <p>Add items to your pantry to get personalized recipe suggestions</p>
          </div>
        )}
      </div>
    </div>
  );
}
