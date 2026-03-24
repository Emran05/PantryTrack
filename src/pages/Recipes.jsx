import { useState, useMemo } from 'react';
import { getPantryItems } from '../lib/storage';
import { getRecipeSuggestions } from '../lib/recipes';
import { getExpirationStatus, getDaysUntilExpiration } from '../lib/helpers';
import './Recipes.css';

export default function Recipes() {
  const [items] = useState(() => getPantryItems());
  const [expandedId, setExpandedId] = useState(null);

  const suggestions = useMemo(() => getRecipeSuggestions(items), [items]);

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

  return (
    <div className="page-content app-container">
      <div className="recipes-header animate-fade-in">
        <h2 className="page-title">Recipes</h2>
        <p className="page-subtitle">Dishes you can make with what you have</p>
      </div>

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
            const matchPct = Math.round(recipe.matchRatio * 100);
            return (
              <div
                key={recipe.id}
                className={`recipe-card card animate-fade-in ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleExpand(recipe.id)}
              >
                <div className="recipe-card-top">
                  <div className="recipe-card-info">
                    <h3 className="recipe-card-title">{recipe.title}</h3>
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
                  {recipe.matched.map((ing) => (
                    <span key={ing} className="recipe-ing-tag have">{ing}</span>
                  ))}
                  {recipe.missing.map((ing) => (
                    <span key={ing} className="recipe-ing-tag missing">{ing}</span>
                  ))}
                </div>

                {/* Expanded: Instructions */}
                {isExpanded && (
                  <div className="recipe-instructions animate-fade-in">
                    <h4>Instructions</h4>
                    <ol>
                      {recipe.instructions.map((step, i) => (
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
