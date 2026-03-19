'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast, ToastContainer } from '@/components/ui/Toast'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type BotUser = {
  id: string
  telegramUserId: string
  telegramUsername: string | null
  firstName: string
  balance: string
  joinedAt: string
  lastActive: string
  isBanned: boolean
  channelVerified: boolean
}

export default function BotUsersPage() {
  const params = useParams<{ botId: string }>()
  const botId = params.botId
  const supabase = createClient()
  const { toasts, removeToast, toast } = useToast()

  const [users, setUsers] = useState<BotUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'all' | 'banned' | 'active'>('all')
  const [selectedUser, setSelectedUser] = useState<BotUser | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [botId])

  async function loadUsers() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('bot_users')
        .select('*')
        .eq('bot_id', botId)
        .order('last_active', { ascending: false })
      
      if (error) throw error
      setUsers(data || [])
    } catch (e: any) {
      toast.error('Failed to load users: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = useMemo(() => {
    let filtered = users

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.telegramUsername && user.telegramUsername.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Apply status filter
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    if (filter === 'active') {
      filtered = filtered.filter(user => new Date(user.lastActive) > sevenDaysAgo && !user.isBanned)
    } else if (filter === 'banned') {
      filtered = filtered.filter(user => user.isBanned)
    }

    return filtered
  }, [users, searchTerm, filter])

  async function banUser(userId: string) {
    if (!confirm('Are you sure you want to ban this user?')) return
    
    setActionLoading(userId)
    try {
      const { error } = await supabase
        .from('bot_users')
        .update({ is_banned: true })
        .eq('id', userId)
      
      if (error) throw error
      toast.success('User banned successfully')
      await loadUsers()
    } catch (e: any) {
      toast.error('Failed to ban user: ' + e.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function unbanUser(userId: string) {
    setActionLoading(userId)
    try {
      const { error } = await supabase
        .from('bot_users')
        .update({ is_banned: false })
        .eq('id', userId)
      
      if (error) throw error
      toast.success('User unbanned successfully')
      await loadUsers()
    } catch (e: any) {
      toast.error('Failed to unban user: ' + e.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function resetBalance(userId: string) {
    if (!confirm('Are you sure you want to reset this user\'s balance to 0?')) return
    
    setActionLoading(userId)
    try {
      // Reset balance
      const { error: balanceError } = await supabase
        .from('bot_users')
        .update({ balance: 0 })
        .eq('id', userId)
      
      if (balanceError) throw balanceError

      // Add transaction record
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          id: crypto.randomUUID(),
          bot_id: botId,
          bot_user_id: userId,
          type: 'admin_reset',
          amount_currency: 0,
          amount_usd: 0,
          status: 'completed'
        })
      
      if (txError) throw txError
      
      toast.success('Balance reset successfully')
      await loadUsers()
    } catch (e: any) {
      toast.error('Failed to reset balance: ' + e.message)
    } finally {
      setActionLoading(null)
    }
  }

  function exportCSV() {
    const csv = [
      'ID,Name,Username,Balance,Joined,Last Active,Banned',
      ...filteredUsers.map(u => `${u.id},${u.firstName},${u.telegramUsername || ''},${u.balance},${u.joinedAt},${u.lastActive},${u.isBanned}`)
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bot-users-${botId}.csv` 
    a.click()
    URL.revokeObjectURL(url)
  }

  function formatRelativeTime(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <LoadingSpinner size={24} color="#2563eb" />
        <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading users...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>
            Bot Users
            <span style={{
              marginLeft: '0.5rem',
              padding: '2px 8px',
              background: '#f1f5f9',
              color: '#1d4ed8',
              borderRadius: '12px',
              fontSize: '0.875rem',
              fontWeight: 500
            }}>
              {filteredUsers.length}
            </span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '4px' }}>
            Manage and monitor your bot users
          </p>
        </div>
        <Button onClick={exportCSV} variant="secondary" size="sm">
          📊 Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 200px 150px', 
        gap: '1rem', 
        marginBottom: '1.5rem',
        padding: '1rem',
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '12px'
      }}>
        <div>
          <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>
            Search users
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or username..."
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem'
            }}
          />
        </div>
        
        <div>
          <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>
            Status
          </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem'
            }}
          >
            <option value="all">All Users</option>
            <option value="active">Active (7 days)</option>
            <option value="banned">Banned</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'end' }}>
          <Button onClick={loadUsers} variant="secondary" size="sm">
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Users table */}
      <div style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>#</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Username</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Balance</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Joined</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Last Active</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                    No users found matching your criteria
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{index + 1}</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{user.firstName}</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                      {user.telegramUsername ? (
                        <span style={{ color: '#2563eb' }}>@{user.telegramUsername}</span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>No username</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: 500 }}>
                      {user.balance}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                      {new Date(user.joinedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                      {formatRelativeTime(user.lastActive)}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                      {user.isBanned ? (
                        <span style={{ 
                          padding: '2px 8px', 
                          background: '#fef2f2', 
                          color: '#dc2626', 
                          borderRadius: '12px', 
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}>
                          Banned
                        </span>
                      ) : (
                        <span style={{ 
                          padding: '2px 8px', 
                          background: '#f0fdf4', 
                          color: '#166534', 
                          borderRadius: '12px', 
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}>
                          Active
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => setSelectedUser(user)}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            background: 'white',
                            color: '#374151',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          View
                        </button>
                        {user.isBanned ? (
                          <button
                            onClick={() => unbanUser(user.id)}
                            disabled={actionLoading === user.id}
                            style={{
                              padding: '4px 8px',
                              border: '1px solid #059669',
                              borderRadius: '6px',
                              background: '#ecfdf5',
                              color: '#059669',
                              fontSize: '0.75rem',
                              cursor: actionLoading === user.id ? 'wait' : 'pointer'
                            }}
                          >
                            {actionLoading === user.id ? '...' : 'Unban'}
                          </button>
                        ) : (
                          <button
                            onClick={() => banUser(user.id)}
                            disabled={actionLoading === user.id}
                            style={{
                              padding: '4px 8px',
                              border: '1px solid #dc2626',
                              borderRadius: '6px',
                              background: '#fef2f2',
                              color: '#dc2626',
                              fontSize: '0.75rem',
                              cursor: actionLoading === user.id ? 'wait' : 'pointer'
                            }}
                          >
                            {actionLoading === user.id ? '...' : 'Ban'}
                          </button>
                        )}
                        <button
                          onClick={() => resetBalance(user.id)}
                          disabled={actionLoading === user.id}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #6b7280',
                            borderRadius: '6px',
                            background: '#f9fafb',
                            color: '#6b7280',
                            fontSize: '0.75rem',
                            cursor: actionLoading === user.id ? 'wait' : 'pointer'
                          }}
                        >
                          {actionLoading === user.id ? '...' : 'Reset'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                User Details
              </h2>
              <button
                onClick={() => setSelectedUser(null)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  background: '#f3f4f6',
                  color: '#6b7280',
                  fontSize: '18px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6b7280' }}>Telegram ID</label>
                <p style={{ margin: '4px 0', fontSize: '1rem', color: '#1e293b' }}>{selectedUser.telegramUserId}</p>
              </div>
              
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6b7280' }}>Name</label>
                <p style={{ margin: '4px 0', fontSize: '1rem', color: '#1e293b' }}>
                  {selectedUser.firstName} {selectedUser.telegramUsername && `(@${selectedUser.telegramUsername})`}
                </p>
              </div>
              
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6b7280' }}>Current Balance</label>
                <p style={{ margin: '4px 0', fontSize: '1.25rem', fontWeight: 600, color: '#1e293b' }}>
                  {selectedUser.balance}
                </p>
              </div>
              
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6b7280' }}>Channel Verified</label>
                <p style={{ margin: '4px 0', fontSize: '1rem', color: '#1e293b' }}>
                  {selectedUser.channelVerified ? '✅ Yes' : '❌ No'}
                </p>
              </div>
              
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6b7280' }}>Join Date</label>
                <p style={{ margin: '4px 0', fontSize: '1rem', color: '#1e293b' }}>
                  {new Date(selectedUser.joinedAt).toLocaleDateString()}
                </p>
              </div>
              
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6b7280' }}>Last Active</label>
                <p style={{ margin: '4px 0', fontSize: '1rem', color: '#1e293b' }}>
                  {formatRelativeTime(selectedUser.lastActive)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
