import { useEffect, useState } from 'react';
import { getSyncStatus, subscribeSyncStatus } from './syncStatus';
import { syncIssue, sameIssue } from './syncIssue';

// The current sync problem worth showing (see syncIssue.js), or null. Updates as sync status
// changes, and only re-renders when the problem itself changes, not on every push or pull.
export function useSyncIssue() {
  const [issue, setIssue] = useState(() => syncIssue(getSyncStatus().errors));
  useEffect(() => {
    setIssue(prev => { const next = syncIssue(getSyncStatus().errors); return sameIssue(prev, next) ? prev : next; });
    return subscribeSyncStatus(s => {
      const next = syncIssue(s.errors);
      setIssue(prev => (sameIssue(prev, next) ? prev : next));
    });
  }, []);
  return issue;
}
