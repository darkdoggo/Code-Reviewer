import { toast as sonnerToast } from 'sonner'

/**
 * Toast notification utilities
 * Use for transient messages that auto-dismiss
 */
export const toast = {
  /**
   * Success message (green, 3s)
   * Use for: successful operations, confirmations
   */
  success: (message: string, description?: string) => {
    sonnerToast.success(message, { description, duration: 3000 })
  },

  /**
   * Error message (red, 5s)
   * Use for: system errors, critical failures
   */
  error: (message: string, description?: string) => {
    sonnerToast.error(message, { description, duration: 5000 })
  },

  /**
   * Info message (blue, 4s)
   * Use for: informational updates, status changes
   */
  info: (message: string, description?: string) => {
    sonnerToast.info(message, { description, duration: 4000 })
  },

  /**
   * Warning message (yellow, 4s)
   * Use for: non-critical warnings, deprecations
   */
  warning: (message: string, description?: string) => {
    sonnerToast.warning(message, { description, duration: 4000 })
  },

  /**
   * User operation error (yellow with lightbulb, 5s)
   * Use for: user mistakes, missing prerequisites, operation errors
   * Examples: no staged files, branch doesn't exist, invalid input
   */
  userError: (message: string, description?: string) => {
    sonnerToast.warning(message, {
      description,
      duration: 5000,
      icon: '💡',
    })
  },

  /**
   * Promise-based toast with loading/success/error states
   * Use for: async operations like saving config, running tests
   */
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string
      error: string
    }
  ) => {
    return sonnerToast.promise(promise, messages)
  },
}
