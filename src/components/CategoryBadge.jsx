import { getCategoryInfo } from '../lib/helpers';
import './CategoryBadge.css';

export default function CategoryBadge({ categoryId, size = 'sm' }) {
  const cat = getCategoryInfo(categoryId);
  return (
    <span
      className={`category-badge category-badge-${size}`}
      style={{ '--cat-color': cat.color }}
    >
      <span className="category-dot" />
      <span className="category-label">{cat.label}</span>
    </span>
  );
}
