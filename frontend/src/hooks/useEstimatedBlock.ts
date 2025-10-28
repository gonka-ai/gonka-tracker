import { useEffect, useState } from 'react'

export function useEstimatedBlock(
  confirmedHeight: number,
  confirmedTimestamp: string,
  avgBlockTime: number
): number {
  const [currentTime, setCurrentTime] = useState(Date.now())

  useEffect(() => {
    setCurrentTime(Date.now())
    
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [confirmedTimestamp])

  const blockTimestamp = new Date(confirmedTimestamp).getTime()
  const elapsedSeconds = (currentTime - blockTimestamp) / 1000
  const estimatedBlocksPassed = Math.floor(elapsedSeconds / avgBlockTime)
  
  return confirmedHeight + estimatedBlocksPassed
}

