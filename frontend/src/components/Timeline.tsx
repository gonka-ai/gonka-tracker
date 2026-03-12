import { useEffect, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TimelineResponse } from '../types/inference'
import { useEstimatedBlock } from '../hooks/useEstimatedBlock'
import { EpochTimer } from './EpochTimer'

export function Timeline() {
  const [hoveredBlock, setHoveredBlock] = useState<number | null>(null)
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)
  const [targetHeight, setTargetHeight] = useState<number | null>(null)
  const [urlBlock, setUrlBlock] = useState<number | null>(null)
  const detailedTimelineRef = useRef<HTMLDivElement>(null)

  const apiUrl = import.meta.env.VITE_API_URL || '/api'

  const { data, isLoading: loading, error: queryError, dataUpdatedAt, refetch } = useQuery<TimelineResponse>({
    queryKey: ['timeline'],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/v1/timeline`)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      return response.json()
    },
    staleTime: 60000,
    refetchInterval: 60000,
    refetchIntervalInBackground: true,
    refetchOnMount: true,
    placeholderData: (previousData) => previousData,
  })

  const error = queryError ? (queryError as Error).message : ''

  useEffect(() => {
    if (!data) return

    const params = new URLSearchParams(window.location.search)
    const blockParam = params.get('block')
    const heightParam = params.get('height')
    
    const detailedMinBlock = data.current_block.height
    const detailedMaxBlock = data.current_block.height + data.epoch_length
    
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
  }, [data])

  const estimatedCurrentBlock = useEstimatedBlock(
    data?.current_block.height || 0,
    data?.current_block.timestamp || new Date().toISOString(),
    data?.avg_block_time || 6
  )

  const getEstimatedCurrentBlock = (): number => {
    return data ? estimatedCurrentBlock : 0
  }

  const calculateBlockTime = (blockHeight: number): { utc: string; local: string } => {
    if (!data) return { utc: '', local: '' }

    const blockTimestamp = new Date(data.current_block.timestamp).getTime()
    const isPast = blockHeight <= data.current_block.height

    const blockDiff = blockHeight - data.current_block.height
    const estimatedTime = new Date(blockTimestamp + blockDiff * data.avg_block_time * 1000)
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
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-gray-200">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
          <div className="col-span-2 sm:col-span-1">
            <div className="text-sm font-medium text-gray-500 mb-1 leading-tight">Epoch ID</div>
            <div className="flex items-center gap-2 min-h-[2rem]">
              <span className="text-2xl font-bold text-gray-900 leading-none">
                {data.current_epoch_index}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-gray-900 text-white rounded">
                CURRENT
              </span>
            </div>
          </div>

          <div className="border-t sm:border-t-0 sm:border-l border-gray-200 pt-4 sm:pt-0 sm:pl-4 lg:pl-6">
            <div className="text-sm font-medium text-gray-500 mb-1 leading-tight">Current Block</div>
            <div>
              <div className="text-2xl font-bold text-gray-900 leading-none">
                {getEstimatedCurrentBlock().toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1 min-h-[1.25rem]">
                Last confirmed: {data.current_block.height.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="border-t sm:border-t-0 sm:border-l border-gray-200 pt-4 sm:pt-0 sm:pl-4 lg:pl-6">
            <div className="text-sm font-medium text-gray-500 mb-1 leading-tight">Avg Block Time</div>
            <div>
              <div className="text-2xl font-bold text-gray-900 leading-none">
                {data.avg_block_time.toFixed(2)}s
              </div>
              <div className="text-xs text-gray-500 mt-1 min-h-[1.25rem]"></div>
            </div>
          </div>

          <EpochTimer 
            data={{
              epoch_id: data.current_epoch_index,
              height: data.current_block.height,
              participants: [],
              is_current: true,
              current_block_height: data.current_block.height,
              current_block_timestamp: data.current_block.timestamp,
              avg_block_time: data.avg_block_time,
              next_poc_start_block: data.epoch_stages?.next_poc_start,
              set_new_validators_block: data.epoch_stages?.set_new_validators,
            }}
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t border-gray-200">
          <div className="flex-1 flex items-center justify-center sm:justify-start">
            <span className="text-xs text-gray-500">
              Auto-refreshing every 60s
              {dataUpdatedAt && ` (${Math.floor((Date.now() - dataUpdatedAt) / 1000)}s ago)`}
            </span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-gray-900 text-white font-medium rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Current Epoch</h2>
        </div>

        <div className="relative mt-8">
          {(() => {
            const epochStart = data.current_epoch_start
            const epochEnd = epochStart + data.epoch_length + 300
            const epochRange = epochEnd - epochStart
            const currentBlock = getEstimatedCurrentBlock()
            const progressPos = ((currentBlock - epochStart) / epochRange) * 100

            const epochEvents: Array<{ block: number; label: string; fullLabel: string }> = []

            // PoC start of current epoch
            if (data.epoch_stages?.poc_start && data.epoch_stages.poc_start >= epochStart && data.epoch_stages.poc_start <= epochEnd) {
              epochEvents.push({
                block: data.epoch_stages.poc_start,
                label: `PoC ${data.current_epoch_index} Start`,
                fullLabel: `PoC ${data.current_epoch_index} Start`
              })
            }
            if (data.epoch_stages?.set_new_validators && data.epoch_stages.set_new_validators >= epochStart && data.epoch_stages.set_new_validators <= epochEnd) {
              epochEvents.push({
                block: data.epoch_stages.set_new_validators,
                label: "New Validators",
                fullLabel: "Set New Validators"
              })
            }
            if (data.epoch_stages?.inference_validation_cutoff && data.epoch_stages.inference_validation_cutoff >= epochStart && data.epoch_stages.inference_validation_cutoff <= epochEnd) {
              epochEvents.push({
                block: data.epoch_stages.inference_validation_cutoff,
                label: "Val Cutoff",
                fullLabel: "Inference Validation Cutoff"
              })
            }
            if (data.epoch_stages?.next_poc_start && data.epoch_stages.next_poc_start >= epochStart && data.epoch_stages.next_poc_start <= epochEnd) {
              epochEvents.push({
                block: data.epoch_stages.next_poc_start,
                label: `PoC ${data.current_epoch_index + 1} Start`,
                fullLabel: `PoC ${data.current_epoch_index + 1} Start`
              })
            }

            if (data.cpoc_events) {
              data.cpoc_events.forEach((cpoc, i) => {
                if (cpoc.trigger_height >= epochStart && cpoc.trigger_height <= epochEnd) {
                  epochEvents.push({
                    block: cpoc.trigger_height,
                    label: `cPoC #${i + 1}`,
                    fullLabel: `cPoC #${i + 1} Start`
                  })
                }
                const endBlock = cpoc.end_height || (cpoc.trigger_height + 281)
                if (endBlock >= epochStart && endBlock <= epochEnd) {
                  epochEvents.push({
                    block: endBlock,
                    label: `cPoC #${i + 1} End`,
                    fullLabel: `cPoC #${i + 1} End`
                  })
                }
              })
            }

            // Sort events by block height for proper label placement
            epochEvents.sort((a, b) => a.block - b.block)

            const tickBlocks: number[] = []
            const firstTick = Math.ceil(epochStart / 100) * 100
            for (let block = firstTick; block <= epochEnd; block += 100) {
              tickBlocks.push(block)
            }

            const milestoneBlocks: number[] = []
            const firstMilestone = Math.ceil(epochStart / 1000) * 1000
            for (let block = firstMilestone; block <= epochEnd; block += 1000) {
              milestoneBlocks.push(block)
            }

            // Danger zone: from the epoch start poc through set_new_validators (already happened)
            const currentEpochSetValidators = data.epoch_stages?.set_new_validators
            const currentPocStart = data.current_epoch_start

            // Danger zone near end: validation_cutoff to next_poc_start
            const validationCutoff = data.epoch_stages?.inference_validation_cutoff
            const nextPocStart = data.epoch_stages?.next_poc_start

            return (
              <svg
                width="100%"
                height="280"
                className="overflow-visible cursor-pointer"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const ratio = x / rect.width
                  const block = Math.round(epochStart + ratio * epochRange)
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
                  const block = Math.round(epochStart + ratio * epochRange)
                  handleTimelineClick(block)
                }}
              >
                {/* Danger zone: poc_start to set_new_validators (beginning of epoch) */}
                {currentEpochSetValidators && currentEpochSetValidators >= epochStart && currentPocStart <= epochEnd && (
                  <rect
                    x={`${((Math.max(currentPocStart, epochStart) - epochStart) / epochRange) * 100}%`}
                    y="80"
                    width={`${((Math.min(currentEpochSetValidators, epochEnd) - Math.max(currentPocStart, epochStart)) / epochRange) * 100}%`}
                    height="120"
                    fill="#FEE2E2"
                    opacity="0.5"
                  />
                )}

                {/* Danger zone: validation_cutoff to next_poc_start (end of epoch) */}
                {validationCutoff && nextPocStart && validationCutoff >= epochStart && nextPocStart <= epochEnd && (
                  <rect
                    x={`${((validationCutoff - epochStart) / epochRange) * 100}%`}
                    y="80"
                    width={`${((nextPocStart - validationCutoff) / epochRange) * 100}%`}
                    height="120"
                    fill="#FEE2E2"
                    opacity="0.5"
                  />
                )}

                {data.cpoc_events?.map((cpoc, idx) => {
                  const cpocStart = cpoc.trigger_height
                  const cpocEnd = cpoc.end_height || (cpocStart + 281)
                  if (cpocEnd < epochStart || cpocStart > epochEnd) return null
                  const x1 = ((Math.max(cpocStart, epochStart) - epochStart) / epochRange) * 100
                  const w = ((Math.min(cpocEnd, epochEnd) - Math.max(cpocStart, epochStart)) / epochRange) * 100
                  return (
                    <g key={`cpoc-zone-${idx}`}>
                      <rect
                        x={`${x1}%`}
                        y="80"
                        width={`${w}%`}
                        height="120"
                        fill="#E9D5FF"
                        opacity="0.5"
                      />
                      <line
                        x1={`${((cpocStart - epochStart) / epochRange) * 100}%`}
                        y1="80"
                        x2={`${((cpocStart - epochStart) / epochRange) * 100}%`}
                        y2="200"
                        stroke="#8B5CF6"
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                      />
                    </g>
                  )
                })}

                {/* Main line */}
                <line x1="0" y1="140" x2="100%" y2="140" stroke="#E5E7EB" strokeWidth="2" />

                {/* Tick marks */}
                {tickBlocks.map((block, idx) => {
                  const pos = ((block - epochStart) / epochRange) * 100
                  if (pos < 0 || pos > 100) return null
                  return (
                    <line key={`ct-${idx}`} x1={`${pos}%`} y1="130" x2={`${pos}%`} y2="150" stroke="#D1D5DB" strokeWidth="1" opacity="0.3" />
                  )
                })}

                {/* Milestone labels */}
                {milestoneBlocks.map((block, idx) => {
                  const pos = ((block - epochStart) / epochRange) * 100
                  if (pos < 0 || pos > 100) return null
                  return (
                    <g key={`cm-${idx}`}>
                      <line x1={`${pos}%`} y1="120" x2={`${pos}%`} y2="160" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.5" />
                      <text x={`${pos}%`} y="175" textAnchor="middle" className="text-xs fill-gray-500" style={{ fontSize: '10px' }}>
                        {block.toLocaleString()}
                      </text>
                    </g>
                  )
                })}

                {/* Stage events — pre-assign top/bottom to avoid overlap */}
                {(() => {
                  // Pre-compute positions and assign levels to avoid label overlaps
                  // Levels: 0=bottom, 1=top, 2=bottom-far
                  const positions = epochEvents.map(e => ((e.block - epochStart) / epochRange) * 100)
                  const levels: number[] = []
                  const THRESHOLD = 7 // % min distance between labels on same level

                  epochEvents.forEach((_event, idx) => {
                    const pos = positions[idx]
                    // Try each level in order: bottom, top, bottom-far
                    for (const level of [0, 1, 2]) {
                      let conflict = false
                      for (let j = idx - 1; j >= 0; j--) {
                        if (levels[j] === level && Math.abs(pos - positions[j]) < THRESHOLD) {
                          conflict = true
                          break
                        }
                      }
                      if (!conflict) {
                        levels.push(level)
                        return
                      }
                    }
                    levels.push(0) // fallback
                  })

                  const levelConfig = [
                    { labelY: 210, lineY1: 200 }, // bottom
                    { labelY: 55, lineY1: 80 },   // top
                    { labelY: 240, lineY1: 200 },  // bottom-far
                  ]

                  return epochEvents.map((event, idx) => {
                    const position = positions[idx]
                    if (position < 0 || position > 100) return null

                    const isPast = event.block <= currentBlock
                    const isCpoc = event.label.startsWith('cPoC')
                    const color = isCpoc ? '#8B5CF6' : (isPast ? '#6B7280' : '#3B82F6')
                    const config = levelConfig[levels[idx]]

                    const labelY = config.labelY
                    const lineY1 = config.lineY1

                    return (
                      <g
                        key={`ce-${idx}`}
                        className="cursor-pointer"
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
                          stroke={color}
                          strokeWidth="2"
                          strokeDasharray="4 2"
                        />
                        <circle cx={`${position}%`} cy="140" r="5" fill={color} />
                        <text
                          x={`${position}%`}
                          y={labelY}
                          textAnchor="middle"
                          className="text-xs font-semibold"
                          fill={color}
                        >
                          {event.label}
                        </text>
                        <text
                          x={`${position}%`}
                          y={labelY + 12}
                          textAnchor="middle"
                          className="text-xs"
                          fill={color}
                        >
                          {event.block.toLocaleString()}
                        </text>
                      </g>
                    )
                  })
                })()}

                {/* Current block marker — drawn last to be on top */}
                <line
                  x1={`${progressPos}%`}
                  y1="80"
                  x2={`${progressPos}%`}
                  y2="200"
                  stroke="#111827"
                  strokeWidth="2"
                />
                <text
                  x={`${progressPos}%`}
                  y="35"
                  textAnchor="middle"
                  className="text-sm fill-gray-900 font-semibold"
                >
                  Current
                </text>

                {/* Hover line */}
                {hoveredBlock !== null && hoveredBlock >= epochStart && hoveredBlock <= epochEnd && (
                  <line
                    x1={`${((hoveredBlock - epochStart) / epochRange) * 100}%`}
                    y1="80"
                    x2={`${((hoveredBlock - epochStart) / epochRange) * 100}%`}
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

        {hoveredBlock !== null && mousePosition && (
          <div
            className="fixed z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm pointer-events-none"
            style={{
              left: mousePosition.x + 10,
              top: mousePosition.y - 80,
            }}
          >
            <div className="font-semibold">Block {hoveredBlock.toLocaleString()}</div>
            <div className="text-xs text-gray-300 mt-1">
              {calculateBlockTime(hoveredBlock).utc}
            </div>
            <div className="text-xs text-gray-300">
              {calculateBlockTime(hoveredBlock).local}
            </div>
          </div>
        )}
      </div>

      <div ref={detailedTimelineRef} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Next Epoch</h2>
          {(() => {
            const detailedMinBlock = data.current_block.height
            const detailedMaxBlock = data.current_block.height + data.epoch_length
            const blockToShow = targetHeight || urlBlock
            
            if (blockToShow && blockToShow >= detailedMinBlock && blockToShow <= detailedMaxBlock) {
              const currentEstimatedBlock = getEstimatedCurrentBlock()
              
              const blocksUntilTarget = blockToShow - currentEstimatedBlock
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
                        y="80"
                        width={`${((Math.min(currentEpochSetValidators, detailedMaxBlock) - Math.max(currentPocStart, detailedMinBlock)) / detailedBlockRange) * 100}%`}
                        height="120"
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
                    y="80"
                    width={`${((Math.min(setValidators, detailedMaxBlock) - Math.max(validationCutoff, detailedMinBlock)) / detailedBlockRange) * 100}%`}
                    height="120"
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
                        y="80"
                        width={`${((Math.min(secondSetValidators, detailedMaxBlock) - Math.max(nextValidationCutoff, detailedMinBlock)) / detailedBlockRange) * 100}%`}
                        height="120"
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
        <h2 className="text-xl font-bold text-gray-900 mb-4">Epoch Schedule</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Epoch</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Start Block</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">End Block</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Start Date</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">End Date</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Duration</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(() => { const currentIdx = epochData.findIndex(e => e.epochNumber === data.current_epoch_index); const sliced = epochData.slice(currentIdx >= 0 ? currentIdx : 0, (currentIdx >= 0 ? currentIdx : 0) + 10); return sliced.map((epoch, idx) => {
                const nextEpoch = sliced[idx + 1]
                const endBlock = nextEpoch ? nextEpoch.block - 1 : epoch.block + data.epoch_length - 1
                const startTime = calculateBlockTime(epoch.block)
                const endTime = calculateBlockTime(endBlock)
                const isCurrent = epoch.epochNumber === data.current_epoch_index
                const durationBlocks = endBlock - epoch.block + 1
                const durationSeconds = durationBlocks * data.avg_block_time
                const durationHours = Math.floor(durationSeconds / 3600)
                const durationMinutes = Math.round((durationSeconds % 3600) / 60)

                return (
                  <tr
                    key={epoch.epochNumber}
                    className={isCurrent ? 'bg-blue-50 font-semibold' : 'hover:bg-gray-50'}
                  >
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {epoch.epochNumber}
                      {isCurrent && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">current</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right font-mono">{epoch.block.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right font-mono">{endBlock.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{startTime.utc}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{endTime.utc}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{durationHours}h {durationMinutes}m</td>
                  </tr>
                )
              })})()}
            </tbody>
          </table>
        </div>

        {data.epoch_stages && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Current Epoch Stages — Epoch {data.epoch_stages!.epoch_index ?? data.current_epoch_index}</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Stage</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Block</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Estimated Date</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    const allStages: Array<{ label: string; block: number; isCpoc: boolean }> = []

                    Object.entries(data.epoch_stages!)
                      .filter(([key, val]) => typeof val === 'number' && key !== 'epoch_index')
                      .forEach(([key, block]) => {
                        allStages.push({
                          label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                          block: block as number,
                          isCpoc: false,
                        })
                      })

                    data.cpoc_events?.forEach((cpoc, idx) => {
                      const endBlock = cpoc.end_height || (cpoc.trigger_height + 281)
                      allStages.push({ label: `cPoC #${idx + 1} Start`, block: cpoc.trigger_height, isCpoc: true })
                      allStages.push({ label: `cPoC #${idx + 1} End`, block: endBlock, isCpoc: true })
                    })

                    allStages.sort((a, b) => a.block - b.block)

                    return allStages.map((stage) => {
                      const time = calculateBlockTime(stage.block)
                      const isPast = stage.block <= getEstimatedCurrentBlock()

                      return (
                        <tr key={`${stage.label}-${stage.block}`} className={isPast ? 'text-gray-400' : ''}>
                          <td className={`px-4 py-2 text-sm ${stage.isCpoc ? 'text-purple-500 font-medium' : ''}`}>{stage.label}</td>
                          <td className="px-4 py-2 text-sm text-right font-mono">{stage.block.toLocaleString()}</td>
                          <td className="px-4 py-2 text-sm">{time.utc}</td>
                          <td className="px-4 py-2 text-sm text-center">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                              isPast
                                ? 'bg-gray-200 text-gray-600'
                                : stage.isCpoc ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {isPast ? 'PAST' : 'UPCOMING'}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
