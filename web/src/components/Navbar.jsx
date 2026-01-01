import React from 'react';
import { useGroup } from '../contexts/GroupContext';
import AuthButton from './Auth';

function Navbar({ activeView, setActiveView }) {
    const { currentGroup } = useGroup();

    const navItems = [
        { id: 'add', label: 'Add', icon: 'add' },
        { id: 'dashboard', label: 'Dashboard', icon: 'bar_chart' },
        { id: 'history', label: 'History', icon: 'list' },
        { id: 'groups', label: 'Groups', icon: 'group' },
    ];

    return (
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark-navy sticky-top shadow-lg mb-4">
            <div className="container">
                <a className="navbar-brand d-flex align-items-center gap-2 fw-bold text-white" href="#" onClick={(e) => { e.preventDefault(); setActiveView('dashboard'); }}>
                    <span style={{ fontSize: '1.5rem' }}>✨</span> FinSync
                </a>

                {/* Mobile Toggle (Bootstrap default, requires js for collapse, using simple div for now) */}

                <div className="d-flex align-items-center gap-3 ms-auto">
                    {/* Profile Indicator */}
                    {currentGroup && (
                        <div className="d-none d-md-flex align-items-center gap-2 px-3 py-1 rounded-pill bg-white-10 text-white border border-white-20">
                            <span className="small text-white-50 uppercase tracking-wider" style={{ fontSize: '0.7rem' }}>ACTIVE</span>
                            <span className="fw-medium">{currentGroup.type === 'personal' ? 'so Personal Ledger' : currentGroup.name}</span>
                        </div>
                    )}

                    <AuthButton />
                </div>
            </div>

            {/* Secondary Nav Bar (Bottom of Header) */}
            <div className="container-fluid bg-dark-navy-light border-top border-white-10">
                <div className="container d-flex justify-content-between justify-content-md-start gap-1 py-1 overflow-auto">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveView(item.id)}
                            className={`btn btn-nav flex-grow-1 flex-md-grow-0 d-flex justify-content-center align-items-center gap-2 rounded-0 border-0 py-3 px-2 ${activeView === item.id ? 'active text-primary border-bottom border-primary border-3' : 'text-white-50 hover-text-white'
                                }`}
                            style={{ transition: 'all 0.2s', position: 'relative', top: '1px' }}
                        >
                            <span className="fw-medium">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
