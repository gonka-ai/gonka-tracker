import { useQueryClient } from '@tanstack/react-query'

const apiUrl = import.meta.env.VITE_API_URL || '/api'

export function usePrefetch() {
  const queryClient = useQueryClient()

  const prefetchTimeline = () => {
    queryClient.prefetchQuery({
      queryKey: ['timeline'],
      queryFn: async () => {
        const response = await fetch(`${apiUrl}/v1/timeline`)
        if (!response.ok) throw new Error('Failed to fetch timeline')
        return response.json()
      },
      staleTime: 30000,
    })
  }

  const prefetchModels = () => {
    queryClient.prefetchQuery({
      queryKey: ['models', 'current'],
      queryFn: async () => {
        const response = await fetch(`${apiUrl}/v1/models/current`)
        if (!response.ok) throw new Error('Failed to fetch models')
        return response.json()
      },
      staleTime: 30000,
    })
  }

  const prefetchAll = () => {
    prefetchTimeline()
    prefetchModels()
  }

  return { prefetchTimeline, prefetchModels, prefetchAll }
}

