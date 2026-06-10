import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getPantryItems, addShoppingItem } from '../lib/supabaseStorage';
import { usePantry } from '../contexts/PantryContext';
import { getRecipeSuggestions, getAIRecipeSuggestions, filterRecipesByDiet, recipeKey } from '../lib/recipes';
import { getExpirationStatus, getDaysUntilExpiration } from '../lib/helpers';
import { getDiet, setDiet, DIETS, getFavoriteRecipeIds, toggleFavoriteRecipe } from '../lib/preferences';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { useToast } from '../components/ToastContext';
import CookThisModal from '../components/CookThisModal';
import './Recipes.css';

export default function Recipes() {
  const { activePantry } = usePantry();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [aiRecipes, setAiRecipes] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  // aiError is now an object: null | { code, message, resetLabel? }
  const [aiError, setAiError] = useState(null);
  const [diet, setDietState] = useState(getDiet());
  const [favTick, setFavTick] = useState(0);
  const [cookRecipe, setCookRecipe] = useState(null);
  const { showToast } = useToast();
  const aiRequestId = useRef(0);
  const fetchSeqRef = useRef(0);

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

  // AI generation is user-initiated only (the Generate button) — auto-firing
  // on every pantry change burned through API quota for results nobody asked
  // for. Show the "fell back to free tier" toast only once per session.
  const hasShownFallbackToastRef = useRef(false);

  const fetchAINow = useCallback(() => {
    if (items.length === 0) {
      setAiRecipes(null);
      return;
    }

    const requestId = ++aiRequestId.current;
    setAiLoading(true);
    setAiError(null);

    getAIRecipeSuggestions(items, { diet })
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
  }, [items, diet, showToast]);

  // Use AI recipes if available, otherwise local
  const suggestions = aiRecipes && aiRecipes.length > 0 ? aiRecipes : localSuggestions;
  const isUsingAI = aiRecipes && aiRecipes.length > 0;

  // Diet filter applied locally too — the AI prompt asks for it, but the model
  // occasionally cheats, and local suggestions don't go through the AI at all.
  const dietFiltered = useMemo(() => filterRecipesByDiet(suggestions, diet), [suggestions, diet]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const favoriteKeys = useMemo(() => new Set(getFavoriteRecipeIds()), [favTick]);
  const favorites = dietFiltered.filter((r) => favoriteKeys.has(recipeKey(r)));
  const others = dietFiltered.filter((r) => !favoriteKeys.has(recipeKey(r)));

  const handleDietChange = (id) => {
    setDiet(id);          // persist
    setDietState(id);     // re-render + re-arm AI fetch via signature
  };

  const handleToggleFavorite = (e, recipe) => {
    e.stopPropagation();
    const nowFav = toggleFavoriteRecipe(recipeKey(recipe));
    setFavTick((t) => t + 1);
    showToast(nowFav ? `"${recipe.title}" saved to favorites` : `"${recipe.title}" removed from favorites`);
  };

  const handleCookThis = (e, recipe) => {
    e.stopPropagation();
    setCookRecipe(recipe);
  };

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

      {/* Generate / Regenerate — AI runs only when the user asks (saves quota) */}
      {items.length > 0 && !aiLoading && (
        isUsingAI ? (
          <button className="ai-regenerate-btn animate-fade-in" onClick={fetchAINow}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Regenerate AI recipes
          </button>
        ) : (
          <button className="btn btn-primary btn-full ai-generate-btn animate-fade-in" onClick={fetchAINow}>
            <span aria-hidden="true">✨</span>
            Generate AI recipes from my pantry
          </button>
        )
      )}

      {/* AI Loading Indicator */}
      {aiLoading && (
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
            <button className="ai-retry-banner animate-fade-in" onClick={fetchAINow}>
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
          <button className="ai-retry-banner animate-fade-in" onClick={fetchAINow}>
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

      {/* Dietary filter chips */}
      <div className="diet-chips animate-fade-in" role="radiogroup" aria-label="Dietary filter">
        {DIETS.map((d) => (
          <button
            key={d.id}
            className={`diet-chip ${diet === d.id ? 'active' : ''}`}
            onClick={() => handleDietChange(d.id)}
            role="radio"
            aria-checked={diet === d.id}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Recipe Cards */}
      <div className="recipes-list">
        {dietFiltered.length > 0 ? (
          <>
            {favorites.length > 0 && (
              <>
                <h3 className="recipes-section-title">Favorites</h3>
                {favorites.map((recipe) => renderRecipeCard(recipe))}
                <h3 className="recipes-section-title">Suggestions</h3>
              </>
            )}
            {others.map((recipe) => renderRecipeCard(recipe))}
          </>
        ) : (
          <div className="empty-state animate-fade-in">
            <div className="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <h3>{suggestions.length > 0 ? 'No recipes match this diet' : 'No recipe matches'}</h3>
            <p>
              {suggestions.length > 0
                ? 'Try a different dietary filter, or add more items to your pantry'
                : 'Add items to your pantry to get personalized recipe suggestions'}
            </p>
          </div>
        )}
      </div>

      {cookRecipe && (
        <CookThisModal
          recipe={cookRecipe}
          items={items}
          pantryId={activePantry?.id}
          onClose={() => setCookRecipe(null)}
          onDone={fetchItems}
        />
      )}
    </div>
  );

  function renderRecipeCard(recipe) {
    const isExpanded = expandedId === recipe.id;
    const matchPct = Math.round((recipe.matchRatio || 0) * 100);
    const isFav = favoriteKeys.has(recipeKey(recipe));
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
          <button
            className={`recipe-fav-btn ${isFav ? 'active' : ''}`}
            onClick={(e) => handleToggleFavorite(e, recipe)}
            aria-label={isFav ? `Remove ${recipe.title} from favorites` : `Save ${recipe.title} to favorites`}
            aria-pressed={isFav}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
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

        {/* Card actions */}
        <div className="recipe-card-actions">
          {recipe.matched && recipe.matched.length > 0 && (
            <button
              className="btn btn-primary recipe-cook-btn"
              onClick={(e) => handleCookThis(e, recipe)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              I cooked this
            </button>
          )}
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
        </div>

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
  }
}
