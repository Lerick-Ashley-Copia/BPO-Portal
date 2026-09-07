import { useEffect, useState } from 'react'
import { api, ApiError } from '../services/api'

interface ApiDataState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useApiData<T>(path: string): ApiDataState<T> {
  const [state, setState] = useState<ApiDataState<T>>({ data: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false

    setState({ data: null, loading: true, error: null })

    api
      .get<T>(path)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((err) => {
        if (cancelled) return
        const message = err instanceof ApiError ? err.message : 'Something went wrong'
        setState({ data: null, loading: false, error: message })
      })

    return () => {
      cancelled = true
    }
  }, [path])

  return state
}
