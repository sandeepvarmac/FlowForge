'use client'

import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react'
import { Toast } from '@/hooks/use-toast'

interface ToastContainerProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-start gap-3 p-4 rounded-lg shadow-lg border animate-in slide-in-from-right
            ${toast.type === 'success' ? 'bg-green-50 border-green-200' :
              toast.type === 'error' ? 'bg-red-50 border-red-200' :
              toast.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
              'bg-blue-50 border-blue-200'
            }
          `}
        >
          <div className="flex-shrink-0 mt-0.5">
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
            {toast.type === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
            {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-600" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600" />}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              toast.type === 'success' ? 'text-green-900' :
              toast.type === 'error' ? 'text-red-900' :
              toast.type === 'warning' ? 'text-yellow-900' :
              'text-blue-900'
            }`}>
              {toast.message}
            </p>
          </div>
          <button
            onClick={() => onDismiss(toast.id)}
            className={`flex-shrink-0 ${
              toast.type === 'success' ? 'text-green-600 hover:text-green-800' :
              toast.type === 'error' ? 'text-red-600 hover:text-red-800' :
              toast.type === 'warning' ? 'text-yellow-600 hover:text-yellow-800' :
              'text-blue-600 hover:text-blue-800'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
