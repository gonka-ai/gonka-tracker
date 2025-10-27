import { useEffect, useState, useRef } from 'react'
import { TimelineResponse } from '../types/inference'

export function Timeline() {
  const [data, setData] = useState<TimelineResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [hoveredBlock, setHoveredBlock] = useState<number | null>(null)
  const [hoveredEpoch, setHoveredEpoch] = useState<number | null>(null)
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)
  const [targetHeight, setTargetHeight] = useState<number | null>(null)
  const [urlBlock, setUrlBlock] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const detailedTimelineRef = useRef<HTMLDivElement>(null)
  const lastFetchRef = useRef<number>(0)
  const dataFetchTimeRef = useRef<string>('')

  const apiUrl = import.meta.env.VITE_API_URL || '/api'
  const FETCH_INTERVAL = 180000

  useEffect(() => {
    const fetchTimeline = async () => {
      const now = Date.now()
      
      if (lastFetchRef.current > 0 && now - lastFetchRef.current < FETCH_INTERVAL) {
        return
      }
      
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`${apiUrl}/v1/timeline`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        setData(result)
        lastFetchRef.current = now
        dataFetchTimeRef.current = new Date(result.current_block.timestamp).toLocaleString()
        
        const params = new URLSearchParams(window.location.search)
        const blockParam = params.get('block')
        const heightParam = params.get('height')
        
        const detailedMinBlock = result.current_block.height
        const detailedMaxBlock = result.current_block.height + result.epoch_length
        
        if (blockParam) {
          const blockHeight = parseInt(blockParam)
          if (!isNaN(blockHeight)) {
            setHoveredBlock(blockHeight)
            setUrlBlock(blockHeight)
            
            if (blockHeight >= detailedMinBlock && blockHeight <= detailedMaxBlock) {
              setTimeout(() => {
                detailedTimelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }, 100)
            }
          }
        }
        
        if (heightParam) {
          const height = parseInt(heightParam)
          if (!isNaN(height)) {
            setTargetHeight(height)
            
            if (height >= detailedMinBlock && height <= detailedMaxBlock) {
              setTimeout(() => {
                detailedTimelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }, 100)
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch timeline data')
      } finally {
        setLoading(false)
      }
    }

    fetchTimeline()
    
    const intervalId = setInterval(() => {
      fetchTimeline()
    }, FETCH_INTERVAL)
    
    return () => clearInterval(intervalId)
  }, [apiUrl, FETCH_INTERVAL])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [data])

  const calculateBlockTime = (blockHeight: number): { utc: string; local: string } => {
    if (!data) return { utc: '', local: '' }

    const currentHeight = data.current_block.height
    const currentTime = new Date(data.current_block.timestamp).getTime()
    const blockDiff = blockHeight - currentHeight
    const timeDiff = blockDiff * data.avg_block_time * 1000

    const estimatedTime = new Date(currentTime + timeDiff)
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }
    
    return {
      utc: estimatedTime.toLocaleString('en-US', { ...options, timeZone: 'UTC' }) + ' UTC',
      local: estimatedTime.toLocaleString('en-US', { ...options, timeZoneName: 'short' })
    }
  }

  const handleTimelineClick = (blockHeight: number) => {
    setHoveredBlock(blockHeight)
    const params = new URLSearchParams(window.location.search)
    params.set('block', blockHeight.toString())
    window.history.replaceState({}, '', `?${params.toString()}`)
  }

  const formatCountdownTime = (seconds: number): string => {
    const totalSeconds = Math.floor(seconds)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${secs}s`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading timeline...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 text-lg font-semibold mb-2">Error</h2>
          <p className="text-red-600">{error || 'No data available'}</p>
        </div>
      </div>
    )
  }

  const minBlock = data.reference_block.height
  
  const twoMonthsInSeconds = 60 * 24 * 3600
  const blocksInTwoMonths = Math.ceil(twoMonthsInSeconds / data.avg_block_time)
  
  let maxBlock = data.current_block.height + blocksInTwoMonths
  
  const maxEventBlock = Math.max(...data.events.map(e => e.block_height))
  if (maxEventBlock > maxBlock) {
    maxBlock = maxEventBlock + Math.floor(blocksInTwoMonths * 0.1)
  }
  
  const blockRange = maxBlock - minBlock

  const getEpochData = () => {
    const epochs: Array<{ block: number; epochNumber: number }> = []
    
    let epochStart = data.current_epoch_start
    let epochNum = data.current_epoch_index
    
    while (epochStart >= minBlock) {
      epochs.push({ block: epochStart, epochNumber: epochNum })
      epochStart -= data.epoch_length
      epochNum--
    }
    
    epochStart = data.current_epoch_start + data.epoch_length
    epochNum = data.current_epoch_index + 1
    while (epochStart <= maxBlock) {
      epochs.push({ block: epochStart, epochNumber: epochNum })
      epochStart += data.epoch_length
      epochNum++
    }
    
    return epochs.sort((a, b) => a.block - b.block)
  }

  const epochData = getEpochData()

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500">
            Data cached at {dataFetchTimeRef.current} (refreshes every 3 min)
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Current Block</div>
            <div className="text-2xl font-bold text-gray-900">
              {data.current_block.height.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {new Date(data.current_block.timestamp).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Average Block Time</div>
            <div className="text-2xl font-bold text-gray-900">
              {data.avg_block_time.toFixed(2)}s
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Timeline Range</div>
            <div className="text-sm font-bold text-gray-900">
              {minBlock.toLocaleString()} - {maxBlock.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              ~{Math.round(blocksInTwoMonths / (24 * 3600 / data.avg_block_time))} days
            </div>
          </div>
        </div>
      </div>

      <div ref={detailedTimelineRef} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Next Epoch</h2>
          {(() => {
            const detailedMinBlock = data.current_block.height
            const detailedMaxBlock = data.current_block.height + data.epoch_length
            const blockToShow = targetHeight || urlBlock
            
            if (blockToShow && blockToShow >= detailedMinBlock && blockToShow <= detailedMaxBlock) {
              const serverTime = new Date(data.current_block.timestamp).getTime()
              const elapsedSeconds = (currentTime - serverTime) / 1000
              const estimatedBlocksPassed = elapsedSeconds / data.avg_block_time
              const estimatedCurrentBlock = Math.floor(data.current_block.height + estimatedBlocksPassed)
              
              const blocksUntilTarget = blockToShow - estimatedCurrentBlock
              const secondsUntilTarget = Math.max(0, blocksUntilTarget * data.avg_block_time)
              
              if (blocksUntilTarget > 0) {
                return (
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-gray-600">
                      Time to block <span className="font-semibold text-gray-900">{blockToShow.toLocaleString()}</span>:
                    </div>
                    <div className="font-bold text-blue-600">
                      {formatCountdownTime(secondsUntilTarget)}
                    </div>
                    <div className="text-gray-500">
                      (~{Math.ceil(secondsUntilTarget / data.avg_block_time).toLocaleString()} blocks)
                    </div>
                  </div>
                )
              } else {
                return (
                  <div className="text-sm text-gray-600">
                    Block <span className="font-semibold text-gray-900">{blockToShow.toLocaleString()}</span> has passed
                  </div>
                )
              }
            }
            return null
          })()}
        </div>
        
        <div className="relative mt-8">
          {(() => {
            const detailedMinBlock = data.current_block.height
            const detailedMaxBlock = data.current_block.height + data.epoch_length + 300
            const detailedBlockRange = detailedMaxBlock - detailedMinBlock

            const futureEvents: Array<{ block: number; label: string; fullLabel: string }> = []
            if (data.epoch_stages?.set_new_validators && data.epoch_stages.set_new_validators > data.current_block.height && data.epoch_stages.set_new_validators <= detailedMaxBlock) {
              futureEvents.push({
                block: data.epoch_stages.set_new_validators,
                label: "New Validators",
                fullLabel: "Set New Validators"
              })
            }
            if (data.epoch_stages?.inference_validation_cutoff && data.epoch_stages.inference_validation_cutoff > data.current_block.height && data.epoch_stages.inference_validation_cutoff <= detailedMaxBlock) {
              futureEvents.push({
                block: data.epoch_stages.inference_validation_cutoff,
                label: "Val Cutoff",
                fullLabel: "Inference Validation Cutoff"
              })
            }
            if (data.epoch_stages?.next_poc_start && data.epoch_stages.next_poc_start > data.current_block.height && data.epoch_stages.next_poc_start <= detailedMaxBlock) {
              futureEvents.push({
                block: data.epoch_stages.next_poc_start,
                label: `PoC ${data.current_epoch_index + 1} Start`,
                fullLabel: `PoC ${data.current_epoch_index + 1} Start`
              })
            }
            if (data.next_epoch_stages?.set_new_validators && data.next_epoch_stages.set_new_validators > data.current_block.height && data.next_epoch_stages.set_new_validators <= detailedMaxBlock) {
              futureEvents.push({
                block: data.next_epoch_stages.set_new_validators,
                label: "New Validators",
                fullLabel: "Set New Validators"
              })
            }
            
            if (data.epoch_stages?.next_poc_start && data.epoch_length) {
              const secondPocStart = data.epoch_stages.next_poc_start + data.epoch_length
              if (secondPocStart > data.current_block.height && secondPocStart <= detailedMaxBlock) {
                futureEvents.push({
                  block: secondPocStart,
                  label: `PoC ${data.current_epoch_index + 2} Start`,
                  fullLabel: `PoC ${data.current_epoch_index + 2} Start`
                })
              }
            }
            
            if (data.next_epoch_stages?.set_new_validators && data.next_epoch_stages?.next_poc_start && data.next_epoch_stages?.poc_start) {
              const offset = data.next_epoch_stages.set_new_validators - data.next_epoch_stages.poc_start
              const secondSetValidators = data.next_epoch_stages.next_poc_start + offset
              if (secondSetValidators > data.current_block.height && secondSetValidators <= detailedMaxBlock) {
                futureEvents.push({
                  block: secondSetValidators,
                  label: "New Validators",
                  fullLabel: "Set New Validators (Epoch +2)"
                })
              }
            }
            
            if (data.next_epoch_stages?.inference_validation_cutoff && data.next_epoch_stages.inference_validation_cutoff > data.current_block.height && data.next_epoch_stages.inference_validation_cutoff <= detailedMaxBlock) {
              futureEvents.push({
                block: data.next_epoch_stages.inference_validation_cutoff,
                label: "Val Cutoff",
                fullLabel: "Inference Validation Cutoff (Next Epoch)"
              })
            }

            const tickBlocks = []
            const firstTick = Math.ceil(detailedMinBlock / 100) * 100
            for (let block = firstTick; block <= detailedMaxBlock; block += 100) {
              tickBlocks.push(block)
            }

            const milestoneBlocks = []
            const firstMilestone = Math.ceil(detailedMinBlock / 1000) * 1000
            for (let block = firstMilestone; block <= detailedMaxBlock; block += 1000) {
              milestoneBlocks.push(block)
            }

            const currentEpochSetValidators = data.epoch_stages?.set_new_validators
            const validationCutoff = data.epoch_stages?.inference_validation_cutoff
            const setValidators = data.next_epoch_stages?.set_new_validators

            return (
              <svg
                width="100%"
                height="280"
                className="overflow-visible cursor-pointer"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const ratio = x / rect.width
                  const block = Math.round(detailedMinBlock + ratio * detailedBlockRange)
                  setHoveredBlock(block)
                  setMousePosition({ x: e.clientX, y: e.clientY })
                }}
                onMouseLeave={() => {
                  setHoveredBlock(null)
                  setMousePosition(null)
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const ratio = x / rect.width
                  const block = Math.round(detailedMinBlock + ratio * detailedBlockRange)
                  handleTimelineClick(block)
                }}
              >
                {(() => {
                  const currentPocStart = data.current_epoch_start
                  if (currentEpochSetValidators && currentEpochSetValidators >= detailedMinBlock && currentPocStart <= detailedMaxBlock) {
                    return (
                      <rect
                        x={`${((Math.max(currentPocStart, detailedMinBlock) - detailedMinBlock) / detailedBlockRange) * 100}%`}
                        y="40"
                        width={`${((Math.min(currentEpochSetValidators, detailedMaxBlock) - Math.max(currentPocStart, detailedMinBlock)) / detailedBlockRange) * 100}%`}
                        height="200"
                        fill="#FEE2E2"
                        opacity="0.5"
                      />
                    )
                  }
                  return null
                })()}

                {validationCutoff && setValidators && setValidators >= detailedMinBlock && validationCutoff <= detailedMaxBlock && (
                  <rect
                    x={`${((Math.max(validationCutoff, detailedMinBlock) - detailedMinBlock) / detailedBlockRange) * 100}%`}
                    y="40"
                    width={`${((Math.min(setValidators, detailedMaxBlock) - Math.max(validationCutoff, detailedMinBlock)) / detailedBlockRange) * 100}%`}
                    height="200"
                    fill="#FEE2E2"
                    opacity="0.5"
                  />
                )}

                {(() => {
                  const nextValidationCutoff = data.next_epoch_stages?.inference_validation_cutoff
                  const nextPocStart = data.next_epoch_stages?.next_poc_start
                  const nextSetValidators = data.next_epoch_stages?.set_new_validators
                  const nextEpochPocStart = data.next_epoch_stages?.poc_start
                  
                  if (!nextValidationCutoff || !nextPocStart || !nextSetValidators || !nextEpochPocStart) return null
                  
                  const offset = nextSetValidators - nextEpochPocStart
                  const secondSetValidators = nextPocStart + offset
                  
                  if (secondSetValidators >= detailedMinBlock && nextValidationCutoff <= detailedMaxBlock) {
                    return (
                      <rect
                        x={`${((Math.max(nextValidationCutoff, detailedMinBlock) - detailedMinBlock) / detailedBlockRange) * 100}%`}
                        y="40"
                        width={`${((Math.min(secondSetValidators, detailedMaxBlock) - Math.max(nextValidationCutoff, detailedMinBlock)) / detailedBlockRange) * 100}%`}
                        height="200"
                        fill="#FEE2E2"
                        opacity="0.5"
                      />
                    )
                  }
                  return null
                })()}

                <line
                  x1="0"
                  y1="140"
                  x2="100%"
                  y2="140"
                  stroke="#E5E7EB"
                  strokeWidth="2"
                />

                {tickBlocks.map((block, idx) => {
                  const position = ((block - detailedMinBlock) / detailedBlockRange) * 100
                  if (position < 0 || position > 100) return null
                  
                  return (
                    <line
                      key={`tick-${idx}`}
                      x1={`${position}%`}
                      y1="130"
                      x2={`${position}%`}
                      y2="150"
                      stroke="#D1D5DB"
                      strokeWidth="1"
                      opacity="0.3"
                    />
                  )
                })}

                {milestoneBlocks.map((block, idx) => {
                  const position = ((block - detailedMinBlock) / detailedBlockRange) * 100
                  if (position < 0 || position > 100) return null
                  
                  return (
                    <g key={`milestone-${idx}`}>
                      <line
                        x1={`${position}%`}
                        y1="120"
                        x2={`${position}%`}
                        y2="160"
                        stroke="#9CA3AF"
                        strokeWidth="1.5"
                        opacity="0.5"
                      />
                      <text
                        x={`${position}%`}
                        y="175"
                        textAnchor="middle"
                        className="text-xs fill-gray-500"
                        style={{ fontSize: '10px' }}
                      >
                        {block.toLocaleString()}
                      </text>
                    </g>
                  )
                })}

                <line
                  x1={`${((data.current_block.height - detailedMinBlock) / detailedBlockRange) * 100}%`}
                  y1="80"
                  x2={`${((data.current_block.height - detailedMinBlock) / detailedBlockRange) * 100}%`}
                  y2="200"
                  stroke="#111827"
                  strokeWidth="3"
                />
                <text
                  x={`${((data.current_block.height - detailedMinBlock) / detailedBlockRange) * 100}%`}
                  y="70"
                  textAnchor="middle"
                  className="text-sm fill-gray-900 font-semibold"
                >
                  Current
                </text>

                {futureEvents.map((event, idx) => {
                  const position = ((event.block - detailedMinBlock) / detailedBlockRange) * 100
                  if (position < 0 || position > 100) return null
                  
                  const isBottom = idx % 2 === 0
                  const labelY = isBottom ? 250 : 30
                  const lineY1 = isBottom ? 200 : 80
                  
                  const sameRowEvents = futureEvents.filter((_e, i) => (i % 2 === 0) === isBottom)
                  const indexInRow = sameRowEvents.findIndex(e => e.block === event.block)
                  const totalInRow = sameRowEvents.length
                  
                  let textAnchor: "start" | "middle" | "end" = "middle"
                  
                  if (totalInRow > 1) {
                    if (indexInRow === 0) {
                      textAnchor = "end"
                    } else if (indexInRow === totalInRow - 1) {
                      textAnchor = "start"
                    }
                  } else {
                    if (position < 20) {
                      textAnchor = "start"
                    } else if (position > 80) {
                      textAnchor = "end"
                    }
                  }
                  
                  return (
                    <g
                      key={idx}
                      className="cursor-pointer transition-all"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleTimelineClick(event.block)
                      }}
                    >
                      <line
                        x1={`${position}%`}
                        y1={lineY1}
                        x2={`${position}%`}
                        y2="140"
                        stroke="#3B82F6"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                      />
                      <circle
                        cx={`${position}%`}
                        cy="140"
                        r="5"
                        fill="#3B82F6"
                      />
                      <text
                        x={`${position}%`}
                        y={labelY}
                        textAnchor={textAnchor}
                        className="text-xs font-semibold"
                        fill="#3B82F6"
                      >
                        {event.label}
                      </text>
                      <text
                        x={`${position}%`}
                        y={labelY + 12}
                        textAnchor={textAnchor}
                        className="text-xs"
                        fill="#3B82F6"
                      >
                        {event.block.toLocaleString()}
                      </text>
                    </g>
                  )
                })}

                {(() => {
                  const blockToShow = targetHeight || urlBlock
                  if (blockToShow && blockToShow >= detailedMinBlock && blockToShow <= detailedMaxBlock) {
                    return (
                      <g>
                        <line
                          x1={`${((blockToShow - detailedMinBlock) / detailedBlockRange) * 100}%`}
                          y1="80"
                          x2={`${((blockToShow - detailedMinBlock) / detailedBlockRange) * 100}%`}
                          y2="200"
                          stroke="#8B5CF6"
                          strokeWidth="3"
                          strokeDasharray="6 3"
                        />
                        <circle
                          cx={`${((blockToShow - detailedMinBlock) / detailedBlockRange) * 100}%`}
                          cy="140"
                          r="8"
                          fill="#8B5CF6"
                        />
                        <text
                          x={`${((blockToShow - detailedMinBlock) / detailedBlockRange) * 100}%`}
                          y="270"
                          textAnchor="middle"
                          className="text-xs font-semibold"
                          fill="#8B5CF6"
                        >
                          Target
                        </text>
                        <text
                          x={`${((blockToShow - detailedMinBlock) / detailedBlockRange) * 100}%`}
                          y="215"
                          textAnchor="middle"
                          className="text-xs"
                          fill="#8B5CF6"
                        >
                          {blockToShow.toLocaleString()}
                        </text>
                      </g>
                    )
                  }
                  return null
                })()}

                {hoveredBlock !== null && hoveredBlock >= detailedMinBlock && hoveredBlock <= detailedMaxBlock && (
                  <line
                    x1={`${((hoveredBlock - detailedMinBlock) / detailedBlockRange) * 100}%`}
                    y1="80"
                    x2={`${((hoveredBlock - detailedMinBlock) / detailedBlockRange) * 100}%`}
                    y2="200"
                    stroke="#F59E0B"
                    strokeWidth="2"
                    opacity="0.5"
                  />
                )}
              </svg>
            )
          })()}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">2-Month Timeline</h2>
        <div className="relative mt-8">
          <svg
            width="100%"
            height="220"
            className="overflow-visible cursor-pointer"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const x = e.clientX - rect.left
              const ratio = x / rect.width
              const block = Math.round(minBlock + ratio * blockRange)
              setHoveredBlock(block)
              setMousePosition({ x: e.clientX, y: e.clientY })
            }}
            onMouseLeave={() => {
              setHoveredBlock(null)
              setMousePosition(null)
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const x = e.clientX - rect.left
              const ratio = x / rect.width
              const block = Math.round(minBlock + ratio * blockRange)
              handleTimelineClick(block)
            }}
          >
            <line
              x1="0"
              y1="110"
              x2="100%"
              y2="110"
              stroke="#E5E7EB"
              strokeWidth="2"
            />

            {epochData.map((epoch, idx) => {
              const position = ((epoch.block - minBlock) / blockRange) * 100
              if (position < 0 || position > 100) return null
              
              const showLabel = epoch.epochNumber % 3 === 0
              
              return (
                <g
                  key={`epoch-${idx}`}
                  className="cursor-pointer"
                  onMouseEnter={(e) => {
                    e.stopPropagation()
                    setHoveredBlock(epoch.block)
                    setHoveredEpoch(epoch.epochNumber)
                    setMousePosition({ x: e.clientX, y: e.clientY })
                  }}
                  onMouseLeave={() => {
                    setHoveredEpoch(null)
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTimelineClick(epoch.block)
                  }}
                >
                  <line
                    x1={`${position}%`}
                    y1="90"
                    x2={`${position}%`}
                    y2="130"
                    stroke="#D1D5DB"
                    strokeWidth="1.5"
                    opacity="0.5"
                  />
                  {showLabel && (
                    <text
                      x={`${position}%`}
                      y="145"
                      textAnchor="middle"
                      className="text-xs fill-gray-500"
                      style={{ fontSize: '10px' }}
                    >
                      E{epoch.epochNumber}
                    </text>
                  )}
                </g>
              )
            })}

            <line
              x1={`${((data.current_block.height - minBlock) / blockRange) * 100}%`}
              y1="70"
              x2={`${((data.current_block.height - minBlock) / blockRange) * 100}%`}
              y2="150"
              stroke="#111827"
              strokeWidth="3"
            />
            <text
              x={`${((data.current_block.height - minBlock) / blockRange) * 100}%`}
              y="170"
              textAnchor="middle"
              className="text-sm fill-gray-900 font-semibold"
            >
              Current
            </text>

            {data.events.map((event, idx) => {
              const position = ((event.block_height - minBlock) / blockRange) * 100
              if (position < 0 || position > 100) return null
              
              const isPast = event.occurred
              const color = isPast ? '#6B7280' : '#3B82F6'
              
              return (
                <g
                  key={idx}
                  className="cursor-pointer transition-all"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTimelineClick(event.block_height)
                  }}
                >
                  <line
                    x1={`${position}%`}
                    y1="50"
                    x2={`${position}%`}
                    y2="170"
                    stroke={color}
                    strokeWidth="3"
                    strokeDasharray="4 2"
                  />
                  <circle
                    cx={`${position}%`}
                    cy="110"
                    r="6"
                    fill={color}
                  />
                  <text
                    x={`${position}%`}
                    y="40"
                    textAnchor="middle"
                    className="text-xs font-semibold"
                    fill={color}
                  >
                    {event.description}
                  </text>
                  <text
                    x={`${position}%`}
                    y="190"
                    textAnchor="middle"
                    className="text-xs"
                    fill={color}
                  >
                    {event.block_height.toLocaleString()}
                  </text>
                </g>
              )
            })}

            {hoveredBlock !== null && (
              <line
                x1={`${((hoveredBlock - minBlock) / blockRange) * 100}%`}
                y1="70"
                x2={`${((hoveredBlock - minBlock) / blockRange) * 100}%`}
                y2="150"
                stroke="#F59E0B"
                strokeWidth="2"
                opacity="0.5"
              />
            )}
          </svg>
        </div>

        {hoveredBlock !== null && mousePosition && (
          <div
            className="fixed z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm pointer-events-none"
            style={{
              left: mousePosition.x + 10,
              top: mousePosition.y - 80,
            }}
          >
            {hoveredEpoch !== null ? (
              <>
                <div className="font-semibold">Epoch {hoveredEpoch} Start</div>
                <div className="text-xs text-gray-400 mt-1">Block {hoveredBlock.toLocaleString()}</div>
                <div className="text-xs text-gray-300 mt-1">
                  {calculateBlockTime(hoveredBlock).utc}
                </div>
                <div className="text-xs text-gray-300">
                  {calculateBlockTime(hoveredBlock).local}
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold">Block {hoveredBlock.toLocaleString()}</div>
                <div className="text-xs text-gray-300 mt-1">
                  {calculateBlockTime(hoveredBlock).utc}
                </div>
                <div className="text-xs text-gray-300">
                  {calculateBlockTime(hoveredBlock).local}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Network Events</h2>
        
        {data.events.length === 0 ? (
          <p className="text-gray-500">No events scheduled</p>
        ) : (
          <div className="space-y-3">
            {data.events.map((event, index) => {
              const eventTime = calculateBlockTime(event.block_height)
              const isPast = event.occurred

              return (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    isPast
                      ? 'bg-gray-50 border-gray-300 hover:border-gray-400'
                      : 'bg-blue-50 border-blue-300 hover:border-blue-400'
                  }`}
                  onClick={() => handleTimelineClick(event.block_height)}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900">{event.description}</span>
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded ${
                            isPast
                              ? 'bg-gray-200 text-gray-700'
                              : 'bg-blue-200 text-blue-700'
                          }`}
                        >
                          {isPast ? 'PAST' : 'FUTURE'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Block: {event.block_height.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 md:text-right">
                      <div>{eventTime.utc}</div>
                      <div className="text-xs text-gray-500">{eventTime.local}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
