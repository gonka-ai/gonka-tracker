import { useEffect, useState } from 'react'
import { InferenceResponse } from '../types/inference'

interface EpochTimerProps {
  data: InferenceResponse
}

export function EpochTimer({ data }: EpochTimerProps) {
  const [currentTime, setCurrentTime] = useState(Date.now())

  useEffect(() => {
    setCurrentTime(Date.now())
    
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [data.current_block_timestamp])

  if (!data.next_poc_start_block || !data.current_block_height || !data.current_block_timestamp || !data.avg_block_time) {
    return (
      <div className="border-t lg:border-t-0 lg:border-l border-gray-200 pt-4 lg:pt-0 lg:pl-6 col-span-2 sm:col-span-3 lg:col-span-1">
        <div className="text-sm font-medium text-gray-500 mb-1 leading-tight">Time To Next Epoch</div>
        <div>
          <div className="text-2xl font-bold text-gray-900 leading-none">
            -
          </div>
          <div className="text-xs text-gray-500 mt-1 min-h-[1.25rem]"></div>
        </div>
      </div>
    )
  }

  const serverTime = new Date(data.current_block_timestamp).getTime()
  const elapsedSeconds = (currentTime - serverTime) / 1000
  const estimatedBlocksPassed = elapsedSeconds / data.avg_block_time
  const estimatedCurrentBlock = Math.floor(data.current_block_height + estimatedBlocksPassed)

  const isPocInProgress = data.set_new_validators_block 
    && estimatedCurrentBlock >= data.next_poc_start_block 
    && estimatedCurrentBlock < data.set_new_validators_block

  if (isPocInProgress) {
    return (
      <div className="border-t lg:border-t-0 lg:border-l border-gray-200 pt-4 lg:pt-0 lg:pl-6 col-span-2 sm:col-span-3 lg:col-span-1">
        <div className="text-sm font-medium text-gray-500 mb-1 leading-tight">Time To Next Epoch</div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900 leading-none">PoC in Progress</span>
            <span className="h-2 w-2 bg-gray-900 rounded-full animate-pulse"></span>
          </div>
          <div className="text-xs text-gray-500 mt-1 min-h-[1.25rem]"></div>
        </div>
      </div>
    )
  }

  const blocksUntilNextEpoch = data.next_poc_start_block - data.current_block_height
  const secondsUntilNextEpochFromServer = blocksUntilNextEpoch * data.avg_block_time
  const secondsRemaining = Math.max(0, secondsUntilNextEpochFromServer - elapsedSeconds)
  const blocksRemaining = Math.ceil(secondsRemaining / data.avg_block_time)

  const formatTime = (seconds: number): string => {
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

  return (
    <div className="border-t lg:border-t-0 lg:border-l border-gray-200 pt-4 lg:pt-0 lg:pl-6 col-span-2 sm:col-span-3 lg:col-span-1">
      <div className="text-sm font-medium text-gray-500 mb-1 leading-tight">Time To Next Epoch</div>
      <div>
        <div className="text-2xl font-bold text-gray-900 leading-none">
          {formatTime(secondsRemaining)}
        </div>
        <div className="text-xs text-gray-500 mt-1 min-h-[1.25rem]">
          ~{blocksRemaining > 0 ? blocksRemaining.toLocaleString() : 0} blocks remaining
        </div>
      </div>
    </div>
  )
}

