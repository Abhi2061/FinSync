import React from 'react';
import { useGroup } from '../contexts/GroupContext';

const CurrentGroupBanner = () => {
    const { currentGroup } = useGroup();

    if (!currentGroup) return null;

    return (
        <div className="card bg-dark-navy text-white mb-4 border-0 shadow-sm">
            <div className="card-body d-flex align-items-center gap-3 py-3 px-4">
                <div
                    className="rounded-circle d-flex align-items-center justify-content-center bg-white-10 text-white"
                    style={{ width: 48, height: 48, flexShrink: 0 }}
                >
                    <span style={{ fontSize: '1.5rem' }}>
                        {currentGroup.type === 'personal' ? '👤' : '👥'}
                    </span>
                </div>
                <div style={{ minWidth: 0 }}>
                    {/* minWidth 0 allows text truncation if needed */}
                    <div className="small text-white-50 text-uppercase tracking-wider fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                        Current Workspace
                    </div>
                    <div className="h5 mb-0 fw-bold text-truncate">
                        {currentGroup.type === 'personal' ? 'Personal Ledger' : currentGroup.name}
                    </div>
                </div>
                {/* Optional: Add a subtle 'switch' hint or icon if desired in future */}
            </div>
        </div>
    );
};

export default CurrentGroupBanner;
