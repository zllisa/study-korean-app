import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'

export default function Layout() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const navClass = ({ isActive }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r flex flex-col shadow-sm">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-blue-600">🇰🇷 韩语练习</h1>
          <p className="text-xs text-gray-500 mt-1">{user.username}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLink to="/conversation" className={navClass}>
            <span>💬</span> 对话练习
          </NavLink>
          <NavLink to="/errors" className={navClass}>
            <span>📝</span> 我的错误
          </NavLink>
          <NavLink to="/vocabulary" className={navClass}>
            <span>📚</span> 词汇本
          </NavLink>
        </nav>
        <div className="p-3 border-t">
          <button
            onClick={logout}
            className="w-full text-sm text-gray-500 hover:text-red-500 py-2 px-3 rounded-lg hover:bg-red-50 transition-colors text-left"
          >
            退出登录
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
