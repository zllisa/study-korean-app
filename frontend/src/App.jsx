import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Conversation from './pages/Conversation.jsx'
import Errors from './pages/Errors.jsx'
import Vocabulary from './pages/Vocabulary.jsx'
import Layout from './components/Layout/Layout.jsx'

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/conversation" />} />
          <Route path="conversation" element={<Conversation />} />
          <Route path="errors" element={<Errors />} />
          <Route path="vocabulary" element={<Vocabulary />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
