function calculateMetrics(
  sessions, 
  startTime, 
  endTime
) {
  // Filter sessions that fall within the specified time range
  const filteredSessions = sessions.filter(session => {
    const sessionStartTime = typeof session.startTime === 'number' ? 
      session.startTime : new Date(session.startTime).getTime() / 1000;
    const sessionEndTime = typeof session.endTime === 'number' ? 
      session.endTime : new Date(session.endTime).getTime() / 1000;
    
    // Check if session overlaps with the specified time range
    return (sessionStartTime >= startTime && sessionStartTime <= endTime) || 
           (sessionEndTime >= startTime && sessionEndTime <= endTime) ||
           (sessionStartTime <= startTime && sessionEndTime >= endTime);
  });
  
  // Calculate blink rate
  let totalBlinks = 0;
  let earliestTimestamp = Infinity;
  let latestTimestamp = 0;
  
  // Gather blink data from all filtered sessions
  filteredSessions.forEach(session => {
    if (session.blinkTimestamps && session.blinkTimestamps.length > 0) {
      // Add the number of blinks
      totalBlinks += session.blinkTimestamps.length;
      
      // Find the earliest and latest timestamps
      const sessionEarliestTimestamp = Math.min(...session.blinkTimestamps);
      const sessionLatestTimestamp = Math.max(...session.blinkTimestamps);
      
      if (sessionEarliestTimestamp < earliestTimestamp) {
        earliestTimestamp = sessionEarliestTimestamp;
      }
      
      if (sessionLatestTimestamp > latestTimestamp) {
        latestTimestamp = sessionLatestTimestamp;
      }
    }
  });
  
  // Calculate blink rate (blinks per minute)
  let blinkRate = 0;
  if (totalBlinks > 0 && earliestTimestamp !== Infinity && latestTimestamp > earliestTimestamp) {
    const timeSpanMinutes = (latestTimestamp - earliestTimestamp) / 60; // Convert seconds to minutes
    blinkRate = totalBlinks / timeSpanMinutes;
  }
  
  // Calculate ambient light ratio (time spent in 'bright' / total time)
  let totalTimeInDarkLight = 0;
  let totalTimeSpan = 0;
  
  // Using the already filtered sessions
  filteredSessions.forEach(session => {
    // Convert session start/end times to unix timestamps if necessary
    const sessionStartTime = typeof session.startTime === 'number' ? 
      session.startTime : new Date(session.startTime).getTime() / 1000;
    const sessionEndTime = typeof session.endTime === 'number' ? 
      session.endTime : new Date(session.endTime).getTime() / 1000;
    
    // Calculate intersection of session time with requested time range
    const effectiveStartTime = Math.max(sessionStartTime, startTime);
    const effectiveEndTime = Math.min(sessionEndTime, endTime);
    
    // Only proceed if there's a valid intersection
    if (effectiveEndTime > effectiveStartTime) {
      // Add this session's duration to total time span
      totalTimeSpan += (effectiveEndTime - effectiveStartTime);
      
      if (session.lightStateChanges && session.lightStateChanges.length > 0) {
        // Sort the light state changes by timestamp
        const sortedLightChanges = [...session.lightStateChanges].sort((a, b) => a.timestamp - b.timestamp);
        
        // First, handle case where we need to consider time before first light change
        if (sortedLightChanges[0].timestamp > effectiveStartTime) {
          // We need to assume a state for the time before first recorded change
          // For this implementation, we'll assume "bright" (meaning no "dark" time contribution)
          // If you want to change this assumption, modify this section
        }
        
        // Process each light state segment
        for (let i = 0; i < sortedLightChanges.length; i++) {
          const currentChange = sortedLightChanges[i];
          
          // Determine the end of this light state
          const nextTimestamp = (i < sortedLightChanges.length - 1) 
            ? sortedLightChanges[i + 1].timestamp 
            : effectiveEndTime;
          
          // Make sure this light state segment is within our time range
          const segmentStart = Math.max(currentChange.timestamp, effectiveStartTime);
          const segmentEnd = Math.min(nextTimestamp, effectiveEndTime);
          
          // If the segment is valid and the light state is "dark", add its duration to the dark time
          if (segmentEnd > segmentStart && currentChange.ambient_light === "dark") {
            totalTimeInDarkLight += (segmentEnd - segmentStart);
          }
        }
      }
    }
  });
  
  // Calculate ratio of bright light time to total time
  // (1 - dark time ratio) = bright time ratio
  let ambientLightRatio = totalTimeSpan > 0 ? 1 - (totalTimeInDarkLight / totalTimeSpan) : 0;
  
  // Calculate look away ratio (time spent looking away / total time)
  let totalLookAwayTime = 0;
  let lookAwayTimeSpan = 0;
  
  // Using the already filtered sessions
  filteredSessions.forEach(session => {
    // Convert session start/end times to unix timestamps if necessary
    const sessionStartTime = typeof session.startTime === 'number' ? 
      session.startTime : new Date(session.startTime).getTime() / 1000;
    const sessionEndTime = typeof session.endTime === 'number' ? 
      session.endTime : new Date(session.endTime).getTime() / 1000;
    
    // Calculate intersection of session time with requested time range
    const effectiveStartTime = Math.max(sessionStartTime, startTime);
    const effectiveEndTime = Math.min(sessionEndTime, endTime);
    
    // Only proceed if there's a valid intersection
    if (effectiveEndTime > effectiveStartTime) {
      // Add this session's duration to total look away time span
      lookAwayTimeSpan += (effectiveEndTime - effectiveStartTime);
      
      if (session.directionChanges && session.directionChanges.length > 0) {
        // Sort the direction changes by timestamp
        const sortedDirectionChanges = [...session.directionChanges].sort((a, b) => a.timestamp - b.timestamp);
        
        // First, handle case where we need to consider time before first direction change
        if (sortedDirectionChanges[0].timestamp > effectiveStartTime) {
          // We need to assume a direction for the time before first recorded change
          // For this implementation, we'll assume "looking center" (meaning no "looking away" time contribution)
          // If you want to change this assumption, modify this section
        }
        
        // Process each direction state segment
        for (let i = 0; i < sortedDirectionChanges.length; i++) {
          const currentChange = sortedDirectionChanges[i];
          
          // Determine the end of this direction state
          const nextTimestamp = (i < sortedDirectionChanges.length - 1) 
            ? sortedDirectionChanges[i + 1].timestamp 
            : effectiveEndTime;
          
          // Make sure this direction state segment is within our time range
          const segmentStart = Math.max(currentChange.timestamp, effectiveStartTime);
          const segmentEnd = Math.min(nextTimestamp, effectiveEndTime);
          
          // If the segment is valid and the looking_away is 1, add its duration to the look away time
          if (segmentEnd > segmentStart && currentChange.looking_away === 1) {
            totalLookAwayTime += (segmentEnd - segmentStart);
          }
        }
      }
    }
  });
  
  // Calculate ratio of look away time to total time
  let lookAwayRatio = lookAwayTimeSpan > 0 ? totalLookAwayTime / lookAwayTimeSpan : 0;
  
  // Store the total requested time range for the denominator of the formula
  const totalRequestedTimeRange = endTime - startTime;
  
  // Calculate percentage of time not close to the screen based on the formula
  let totalNotCloseTime = 0;
  
  filteredSessions.forEach(session => {
    // Convert session start/end times to unix timestamps if necessary
    const sessionStartTime = typeof session.startTime === 'number' ? 
      session.startTime : new Date(session.startTime).getTime() / 1000;
    const sessionEndTime = typeof session.endTime === 'number' ? 
      session.endTime : new Date(session.endTime).getTime() / 1000;
    
    // Calculate intersection of session time with requested time range
    const effectiveStartTime = Math.max(sessionStartTime, startTime);
    const effectiveEndTime = Math.min(sessionEndTime, endTime);
    
    // Only proceed if there's a valid intersection
    if (effectiveEndTime > effectiveStartTime) {
      if (session.distanceChanges && session.distanceChanges.length > 0) {
        // Sort the distance changes by start_time to ensure chronological order
        const sortedDistanceChanges = [...session.distanceChanges].sort(
          (a, b) => a.start_time - b.start_time
        );
        
        console.log(`  Distance changes (${sortedDistanceChanges.length}):`);
        sortedDistanceChanges.forEach((change, idx) => {
          console.log(`    ${idx + 1}. ${change.distance}: ${new Date(change.start_time * 1000).toLocaleTimeString()} to ${new Date(change.end_time * 1000).toLocaleTimeString()}`);
        });

        // Find the last "close" segment start time before each "not close" segment
        let lastCloseStartTime = null;

        // Process all original distance changes to catch all transitions
        for (let i = 0; i < sortedDistanceChanges.length; i++) {
          const current = sortedDistanceChanges[i];
          
          // Skip if this change is outside our time range
          if (current.end_time < effectiveStartTime || current.start_time > effectiveEndTime) {
            continue;
          }
          
          // Update the last close start time whenever we encounter a "close" segment
          if (current.distance === "close") {
            lastCloseStartTime = current.start_time;
            continue;
          }
          
          // For every "not close" segment (med or far), calculate the time difference
          if (current.distance === "med" || current.distance === "far") {
            const notCloseStartTime = current.start_time;
            
            // If we have a previous close segment, calculate the time difference
            if (lastCloseStartTime !== null) {
              const timeDifference = notCloseStartTime - lastCloseStartTime;
              
              
              
              if (timeDifference > 0) {
                totalNotCloseTime += timeDifference;
                console.log(`    Added to total: now ${totalNotCloseTime} seconds`);
              } else {
                console.log(`    No time added (difference <= 0)`);
              }
            } else {
              // For the first "not close" segment with no previous "close", use session start time
              const referenceTime = effectiveStartTime;
              const timeDifference = notCloseStartTime - referenceTime;
              
              console.log(`  Initial not close segment (no previous close):`);
              console.log(`    Not close start: ${new Date(notCloseStartTime * 1000).toLocaleTimeString()}`);
              console.log(`    Session start: ${new Date(referenceTime * 1000).toLocaleTimeString()}`);
              console.log(`    Time difference: ${timeDifference} seconds (${timeDifference/60} minutes)`);
              
              if (timeDifference > 0) {
                totalNotCloseTime += timeDifference;
                console.log(`    Added to total: now ${totalNotCloseTime} seconds`);
              } else {
                console.log(`    No time added (difference <= 0)`);
              }
            }
          }
        }
      }
    }
  });
  
  // Calculate ratio according to the formula
  let screenDistance = totalRequestedTimeRange > 0 ? totalNotCloseTime / totalRequestedTimeRange : 0;
  
  // Ensure the ratio is between 0 and 1
  screenDistance = Math.min(1, Math.max(0, screenDistance));
  
  // Return the calculated metrics
  return {  
    blinkRate: Number(blinkRate.toFixed(2)),
    ambientLightRatio: Number(ambientLightRatio.toFixed(2)),
    lookAwayRatio: Number(lookAwayRatio.toFixed(2)),
    screenDistance: Number(screenDistance.toFixed(2))
  };
}

const startOfDay = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);  // Unix timestamp for start of today
const endOfDay = Math.floor(new Date().setHours(23, 59, 59, 999) / 1000);  // Unix timestamp for end of today

console.log(`Test period: ${new Date(startOfDay * 1000).toLocaleString()} to ${new Date(endOfDay * 1000).toLocaleString()}`);

// Example array of sessions
const exampleSessions = [
  {
    userId: "65f1b3a4e0e8f98765432101",
    startTime: startOfDay + 9 * 3600,  // 9 AM in Unix timestamp
    endTime: startOfDay + 10 * 3600,   // 10 AM in Unix timestamp
    
    // Blink timestamps (15 blinks per minute during the session)
    blinkTimestamps: Array.from({ length: 900 }, (_, i) => 
      startOfDay + 9 * 3600 + Math.floor(i / 15) * 60 + (i % 15) * 4
    ),
    
    // Direction changes (looking away and back)
    directionChanges: [
      { looking_away: 1, timestamp: startOfDay + 9 * 3600 + 2 * 60 },      // 9:02 AM - looking center
      { looking_away: 1, timestamp: startOfDay + 9 * 3600 + 10 * 60 },     // 9:10 AM - looking away
      { looking_away: 1, timestamp: startOfDay + 9 * 3600 + 11 * 60 },     // 9:11 AM - looking center
      { looking_away: 0, timestamp: startOfDay + 9 * 3600 + 30 * 60 },     // 9:30 AM - looking away
      { looking_away: 1, timestamp: startOfDay + 9 * 3600 + 32 * 60 },     // 9:32 AM - looking center
      { looking_away: 0, timestamp: startOfDay + 9 * 3600 + 45 * 60 },     // 9:45 AM - looking away
      { looking_away: 1, timestamp: startOfDay + 9 * 3600 + 47 * 60 }      // 9:47 AM - looking center
    ],
    
    // Light state changes
    lightStateChanges: [
      { ambient_light: "bright", timestamp: startOfDay + 9 * 3600 },            // 9:00 AM - bright
      { ambient_light: "dark", timestamp: startOfDay + 9 * 3600 + 120 * 60 },   // 11:00 AM - dark 
      { ambient_light: "bright", timestamp: startOfDay + 9 * 3600 + 125 * 60 }, // 11:05 AM - bright
      { ambient_light: "dark", timestamp: startOfDay + 9 * 3600 + 240 * 60 },   // 1:00 PM - dark
      { ambient_light: "bright", timestamp: startOfDay + 9 * 3600 + 245 * 60 }, // 1:05 PM - bright
      { ambient_light: "dark", timestamp: startOfDay + 9 * 3600 + 360 * 60 },   // 3:00 PM - dark
      { ambient_light: "bright", timestamp: startOfDay + 9 * 3600 + 365 * 60 }  // 3:05 PM - bright
    ],
    
    // Distance changes
    distanceChanges: [
      { distance: "med", start_time: startOfDay + 9 * 3600, end_time: startOfDay + 9 * 3600 + 15 * 60 },              // 9:00-9:15 - medium
      { distance: "close", start_time: startOfDay + 9 * 3600 + 15 * 60, end_time: startOfDay + 9 * 3600 + 16 * 60 },  // 9:15-9:16 - close
      { distance: "med", start_time: startOfDay + 9 * 3600 + 16 * 60, end_time: startOfDay + 9 * 3600 + 40 * 60 },    // 9:16-9:40 - medium
      { distance: "far", start_time: startOfDay + 9 * 3600 + 40 * 60, end_time: startOfDay + 9 * 3600 + 60 * 60 }     // 9:40-10:00 - far
    ]
  }
];

const dayMetrics = calculateMetrics(exampleSessions, startOfDay, endOfDay);
console.log("Day metrics:", dayMetrics);  
