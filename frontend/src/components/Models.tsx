import { useEffect, useState } from 'react'
import { ModelsResponse, ModelInfo } from '../types/inference'
import { EpochSelector } from './EpochSelector'
import { ModelModal } from './ModelModal'

export function Models() {
  const [data, setData] = useState<ModelsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [selectedEpochId, setSelectedEpochId] = useState<number | null>(null)
  const [currentEpochId, setCurrentEpochId] = useState<number | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(30)

  const apiUrl = import.meta.env.VITE_API_URL || '/api'

  const fetchData = async (epochId: number | null = null, isAutoRefresh = false) => {
    if (!isAutoRefresh) {
      setLoading(true)
    }
    setError('')

    try {
      const endpoint = epochId
        ? `${apiUrl}/v1/models/epochs/${epochId}`
        : `${apiUrl}/v1/models/current`
      
      const response = await fetch(endpoint)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      setData(result)
      
      if (result.is_current) {
        setCurrentEpochId(result.epoch_id)
      }
      
      setAutoRefreshCountdown(30)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const epochParam = params.get('epoch')
    const modelParam = params.get('model')
    
    if (epochParam) {
      const epochId = parseInt(epochParam)
      if (!isNaN(epochId)) {
        setSelectedEpochId(epochId)
        if (modelParam) {
          setSelectedModelId(modelParam)
        }
        return
      }
    }
    
    if (modelParam) {
      setSelectedModelId(modelParam)
    }
    
    fetchData(null)
  }, [])

  useEffect(() => {
    fetchData(selectedEpochId)
    
    const params = new URLSearchParams(window.location.search)
    params.set('page', 'models')
    
    if (selectedEpochId === null) {
      params.delete('epoch')
    } else {
      params.set('epoch', selectedEpochId.toString())
    }
    
    const newUrl = params.toString() 
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname
    window.history.replaceState({}, '', newUrl)
  }, [selectedEpochId])

  useEffect(() => {
    if (selectedEpochId !== null) return

    const interval = setInterval(() => {
      setAutoRefreshCountdown((prev) => {
        if (prev <= 1) {
          fetchData(null, true)
          return 30
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [selectedEpochId])

  const handleRefresh = () => {
    fetchData(selectedEpochId)
  }

  const handleEpochSelect = (epochId: number | null) => {
    setSelectedEpochId(epochId)
  }

  const handleModelSelect = (modelId: string | null) => {
    setSelectedModelId(modelId)
    
    const params = new URLSearchParams(window.location.search)
    if (modelId) {
      params.set('model', modelId)
    } else {
      params.delete('model')
    }
    
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    window.history.replaceState({}, '', newUrl)
  }

  const handleRowClick = (model: ModelInfo) => {
    handleModelSelect(model.id)
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading models...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 text-lg font-semibold mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const sortedModels = [...data.models].sort((a, b) => b.total_weight - a.total_weight)
  const statsMap = new Map(data.stats.map(s => [s.model, s]))
  
  const selectedModel = selectedModelId 
    ? data.models.find(m => m.id === selectedModelId) || null
    : null
  
  const selectedStats = selectedModelId ? statsMap.get(selectedModelId) || null : null

  return (
    <div>
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6 border border-gray-200">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
          <div className="col-span-2 sm:col-span-1">
            <div className="text-sm font-medium text-gray-500 mb-1 leading-tight">Epoch ID</div>
            <div className="flex items-center gap-2 min-h-[2rem]">
              <span className="text-2xl font-bold text-gray-900 leading-none">
                {data.epoch_id}
              </span>
              {data.is_current && (
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-gray-900 text-white rounded">
                  CURRENT
                </span>
              )}
            </div>
          </div>

          <div className="border-t sm:border-t-0 sm:border-l border-gray-200 pt-4 sm:pt-0 sm:pl-4 lg:pl-6">
            <div className="text-sm font-medium text-gray-500 mb-1 leading-tight">Block Height</div>
            <div className="text-2xl font-bold text-gray-900 leading-none min-h-[2rem] flex items-center">
              {data.height.toLocaleString()}
            </div>
          </div>

          <div className="border-t sm:border-t-0 sm:border-l border-gray-200 pt-4 sm:pt-0 sm:pl-4 lg:pl-6">
            <div className="text-sm font-medium text-gray-500 mb-1 leading-tight">Total Models</div>
            <div className="text-2xl font-bold text-gray-900 leading-none min-h-[2rem] flex items-center">
              {data.models.length}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t border-gray-200">
          <div className="flex-1 flex items-center justify-center sm:justify-start">
            {selectedEpochId === null && (
              <span className="text-xs text-gray-500">Auto-refresh in {autoRefreshCountdown}s</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <EpochSelector
              currentEpochId={currentEpochId || data.epoch_id}
              selectedEpochId={selectedEpochId}
              onSelectEpoch={handleEpochSelect}
              disabled={loading}
            />
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-gray-900 text-white font-medium rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-gray-200">
        <div className="mb-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-1">
            Available Models
          </h2>
          <p className="text-xs md:text-sm text-gray-500">
            Click on a model to view detailed information
          </p>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Model ID
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Total Weight
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Hosts
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Inferences
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  AI Tokens
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedModels.map((model) => {
                const stats = statsMap.get(model.id)
                
                return (
                  <tr
                    key={model.id}
                    onClick={() => handleRowClick(model)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {model.id}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      {model.total_weight.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {model.participant_count}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {stats ? stats.inferences.toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {stats ? parseInt(stats.ai_tokens).toLocaleString() : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ModelModal 
        model={selectedModel}
        stats={selectedStats}
        onClose={() => handleModelSelect(null)} 
      />
    </div>
  )
}

