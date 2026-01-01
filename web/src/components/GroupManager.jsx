import React, { useState } from 'react';
import { useGroup } from '../contexts/GroupContext';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';

const GroupManager = () => {
    const {
        currentUser, currentGroup, userGroups, pendingInvites,
        createGroup, switchGroup, sendInvite, acceptInvite, removeMember, leaveGroup, deleteGroup, loading
    } = useGroup();

    const [newGroupName, setNewGroupName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [activeTab, setActiveTab] = useState('groups'); // groups, members, invites

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center py-5">
            <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
            </div>
        </div>
    );

    if (!currentUser) return <div className="p-4 text-center text-muted">Please log in to manage groups.</div>;

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (newGroupName.trim()) {
            await createGroup(newGroupName);
            setNewGroupName('');
            setActiveTab('groups'); // Stay on groups to see new one
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (inviteEmail.trim()) {
            await sendInvite(inviteEmail);
            setInviteEmail('');
        }
    };

    // Helper for initials
    const getInitials = (name) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    return (
        <div className="container py-4">
            <h4 className="mb-4 fw-bold text-dark">Group Management</h4>

            {/* Custom Tab Navigation */}
            <div className="d-flex gap-2 mb-4 overflow-auto pb-2">
                <button
                    className={`btn rounded-pill px-4 fw-medium ${activeTab === 'groups' ? 'btn-primary shadow-sm' : 'btn-white border text-secondary'}`}
                    onClick={() => setActiveTab('groups')}
                >
                    🏢 My Workspaces
                </button>
                <button
                    className={`btn rounded-pill px-4 fw-medium ${activeTab === 'members' ? 'btn-primary shadow-sm' : 'btn-white border text-secondary'}`}
                    onClick={() => setActiveTab('members')}
                    disabled={!currentGroup}
                >
                    👥 {currentGroup?.type === 'personal' ? 'Profile' : `Members ${currentGroup ? `(${currentGroup.members.length})` : ''}`}
                </button>
                <button
                    className={`btn rounded-pill px-4 fw-medium ${activeTab === 'invites' ? 'btn-primary shadow-sm' : 'btn-white border text-secondary'}`}
                    onClick={() => setActiveTab('invites')}
                >
                    ✉️ Invites {pendingInvites.length > 0 && <span className="badge bg-white text-primary ms-1 rounded-pill">{pendingInvites.length}</span>}
                </button>
            </div>

            <div className="row g-4">
                <div className="col-12">
                    {/* GROUPS TAB */}
                    {activeTab === 'groups' && (
                        <div className="row g-4">
                            {/* Workspace List */}
                            <div className="col-12 col-md-7">
                                <div className="card shadow-sm border-0 h-100">
                                    <div className="card-header bg-white border-bottom py-3">
                                        <h6 className="mb-0 fw-bold text-secondary text-uppercase small">Your Workspaces</h6>
                                    </div>
                                    <div className="card-body p-0">
                                        <div className="list-group list-group-flush">
                                            {userGroups.map(group => (
                                                <button
                                                    key={group.id}
                                                    className={`list-group-item list-group-item-action p-3 d-flex align-items-center gap-3 border-bottom ${currentGroup?.id === group.id ? 'bg-primary bg-opacity-10' : ''}`}
                                                    onClick={() => switchGroup(group.id)}
                                                >
                                                    <div className={`rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 text-white shadow-sm ${group.type === 'personal' ? 'bg-secondary' : 'bg-primary'}`} style={{ width: 40, height: 40, fontSize: '1.2rem' }}>
                                                        {group.type === 'personal' ? '👤' : '👥'}
                                                    </div>
                                                    <div className="flex-grow-1">
                                                        <div className={`fw-bold ${currentGroup?.id === group.id ? 'text-primary' : 'text-dark'}`}>{group.name}</div>
                                                        <div className="small text-muted">{group.type === 'personal' ? 'Private Ledger' : `${group.members?.length || 1} members`}</div>
                                                    </div>
                                                    {currentGroup?.id === group.id && (
                                                        <span className="badge bg-primary rounded-pill">Active</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Create Group Box */}
                            <div className="col-12 col-md-5">
                                <div className="card border-0 shadow-sm bg-indigo-50" style={{ background: '#f8fafc' }}>
                                    <div className="card-body p-4">
                                        <div className="d-flex align-items-center gap-3 mb-3">
                                            <div className="bg-primary text-white rounded bg-opacity-75 p-2 shadow-sm">
                                                ✨
                                            </div>
                                            <h6 className="mb-0 fw-bold">Create New Group</h6>
                                        </div>
                                        <p className="small text-muted mb-3">Start a new shared ledger for trips, roommates, or projects.</p>
                                        <form onSubmit={handleCreateGroup}>
                                            <div className="input-group mb-3">
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="e.g. Goa Trip 2024"
                                                    value={newGroupName}
                                                    onChange={e => setNewGroupName(e.target.value)}
                                                />
                                            </div>
                                            <button type="submit" className="btn btn-dark w-100 shadow-sm" disabled={!newGroupName.trim()}>
                                                Create Group
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MEMBERS TAB */}
                    {activeTab === 'members' && currentGroup && (
                        <div className="card shadow-sm border-0">
                            <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="mb-0 fw-bold">{currentGroup.name}</h6>
                                    <small className="text-muted">{currentGroup.type === 'personal' ? 'Personal Profile' : 'Group Members'}</small>
                                </div>
                                <span className={`badge border ${currentGroup.type === 'personal' ? 'bg-light text-dark' : 'bg-success bg-opacity-10 text-success'}`}>
                                    {currentGroup.type === 'personal' ? 'Private' : 'Shared'}
                                </span>
                            </div>

                            <div className="card-body p-0">
                                {currentGroup.type === 'personal' ? (
                                    <div className="p-5 text-center">
                                        <div className="mb-3 display-4">🔒</div>
                                        <h5>Personal Space</h5>
                                        <p className="text-muted" style={{ maxWidth: '400px', margin: '0 auto' }}>
                                            This is your private ledger. It cannot be shared or deleted. To collaborate with others, create a new Group from the "My Workspaces" tab.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Member List */}
                                        <div className="list-group list-group-flush">
                                            {currentGroup.members.map(uid => (
                                                <div key={uid} className="list-group-item p-3 d-flex align-items-center gap-3">
                                                    <div className="rounded-circle bg-light d-flex align-items-center justify-content-center fw-bold text-secondary border" style={{ width: 40, height: 40 }}>
                                                        {getInitials(currentGroup.memberDetails?.[uid]?.displayName)}
                                                    </div>
                                                    <div className="flex-grow-1">
                                                        <div className="fw-bold text-dark">
                                                            {uid === currentUser.uid ? 'You' : (currentGroup.memberDetails?.[uid]?.displayName || 'Unknown')}
                                                            {uid === currentGroup.admin && <span className="ms-2 badge bg-warning text-dark border border-warning shadow-sm" style={{ fontSize: '0.65rem' }}>Owner</span>}
                                                        </div>
                                                        <div className="small text-muted">{currentGroup.memberDetails?.[uid]?.email}</div>
                                                    </div>

                                                    {currentGroup.admin === currentUser.uid && uid !== currentUser.uid && (
                                                        <button
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => {
                                                                confirmAlert({
                                                                    title: 'Remove Member?',
                                                                    message: `Remove ${currentGroup.memberDetails?.[uid]?.displayName} from this group?`,
                                                                    buttons: [
                                                                        { label: 'Yes', onClick: () => removeMember(uid) },
                                                                        { label: 'Cancel' }
                                                                    ]
                                                                });
                                                            }}
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Admin Actions */}
                                        <div className="p-4 bg-light border-top">
                                            <div className="row g-4">
                                                {currentGroup.admin === currentUser.uid && (
                                                    <div className="col-12 col-md-6">
                                                        <h6 className="fw-bold mb-3">Invite New Member</h6>
                                                        <form onSubmit={handleInvite} className="d-flex gap-2">
                                                            <input
                                                                type="email"
                                                                className="form-control"
                                                                placeholder="friend@email.com"
                                                                value={inviteEmail}
                                                                onChange={e => setInviteEmail(e.target.value)}
                                                            />
                                                            <button type="submit" className="btn btn-primary">Invite</button>
                                                        </form>
                                                    </div>
                                                )}

                                                <div className="col-12 col-md-6 border-start-md">
                                                    <h6 className="fw-bold mb-3 text-danger">Danger Zone</h6>
                                                    <div className="d-flex gap-2">
                                                        {currentGroup.admin !== currentUser.uid && (
                                                            <button className="btn btn-outline-danger" onClick={() => {
                                                                confirmAlert({
                                                                    title: 'Leave Group?',
                                                                    message: 'Are you sure you want to leave this group?',
                                                                    buttons: [
                                                                        { label: 'Yes, Leave', onClick: () => leaveGroup(currentGroup.id) },
                                                                        { label: 'Cancel' }
                                                                    ]
                                                                });
                                                            }}>
                                                                Leave Group
                                                            </button>
                                                        )}
                                                        {currentGroup.admin === currentUser.uid && (
                                                            <button className="btn btn-danger" onClick={() => {
                                                                confirmAlert({
                                                                    title: 'Delete Group?',
                                                                    message: 'This will permanently delete the group and all its transactions for EVERYONE. This action cannot be undone.',
                                                                    buttons: [
                                                                        { label: 'Delete Forever', onClick: () => deleteGroup(currentGroup.id) },
                                                                        { label: 'Cancel' }
                                                                    ]
                                                                });
                                                            }}>
                                                                Delete Group
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* INVITES TAB */}
                    {activeTab === 'invites' && (
                        <div className="card shadow-sm border-0">
                            <div className="card-header bg-white border-bottom py-3">
                                <h6 className="mb-0 fw-bold">Pending Invitations</h6>
                            </div>
                            <div className="card-body p-0">
                                {pendingInvites.length === 0 ? (
                                    <div className="p-5 text-center">
                                        <div className="text-muted display-4 mb-2">📭</div>
                                        <h6 className="text-secondary">No pending invites</h6>
                                        <p className="small text-muted">When someone invites you to a group, it will appear here.</p>
                                    </div>
                                ) : (
                                    <div className="list-group list-group-flush">
                                        {pendingInvites.map(invite => (
                                            <div key={invite.id} className="list-group-item p-4 d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
                                                <div className="d-flex gap-3 align-items-center">
                                                    <div className="bg-primary bg-opacity-10 text-primary rounded p-3">
                                                        ✉️
                                                    </div>
                                                    <div>
                                                        <h6 className="mb-1 fw-bold text-dark">Invite to join "{invite.groupName || 'Unknown Group'}"</h6>
                                                        <p className="mb-0 small text-muted">Invited by <span className="fw-medium text-dark">{invite.inviterName || invite.invitedBy}</span></p>
                                                    </div>
                                                </div>
                                                <div className="d-flex gap-2 w-100 w-md-auto">
                                                    <button className="btn btn-success flex-grow-1 flex-md-grow-0" onClick={() => acceptInvite(invite.id, invite.groupId)}>
                                                        Accept Invitation
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GroupManager;
