import { getExpirationStatus, getDaysUntilExpiration } from '../lib/helpers';
import './ExpirationBadge.css';

export default function ExpirationBadge({ date }) {
  const status = getExpirationStatus(date);
  const days = getDaysUntilExpiration(date);

  if (!status) return null;

  const labels = {
    expired: 'Expired',
    soon: days === 0 ? 'Today' : days === 1 ? '1 day left' : `${days} days left`,
    fresh: `${days}d left`,
  };

  return (
    <span className={`expiration-badge expiration-${status}`}>
      <span className="expiration-dot" />
      {labels[status]}
    </span>
  );
}
