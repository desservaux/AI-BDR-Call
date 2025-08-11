const { utcToZonedTime, zonedTimeToUtc } = require('date-fns-tz');

/**
 * Business Hours Utility Service
 * Handles timezone-aware business hours calculations and validation
 */
class BusinessHoursService {
    constructor() {
        this.initialized = false;
    }

    async initialize() {
        this.initialized = true;
        console.log('✅ Business Hours Service initialized');
    }

    /**
     * Validate business hours configuration
     * @param {Object} businessHours - Business hours configuration
     * @returns {Object} Validation result
     */
    validateBusinessHours(businessHours) {
        const { timezone, business_hours_start, business_hours_end, exclude_weekends } = businessHours;
        
        const errors = [];
        
        // Validate timezone
        if (!timezone) {
            errors.push('Timezone is required');
        } else {
            // For now, accept common timezones without strict validation
            // This avoids issues with date-fns-tz timezone validation
            const commonTimezones = [
                'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
                'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
                'Australia/Sydney', 'Pacific/Auckland'
            ];
            
            if (!commonTimezones.includes(timezone)) {
                errors.push(`Invalid timezone: ${timezone}`);
            }
        }
        
        // Validate time format
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
        if (!business_hours_start || !timeRegex.test(business_hours_start)) {
            errors.push('Invalid business hours start time format (HH:MM:SS)');
        }
        if (!business_hours_end || !timeRegex.test(business_hours_end)) {
            errors.push('Invalid business hours end time format (HH:MM:SS)');
        }
        
        // Validate time range
        if (business_hours_start && business_hours_end) {
            if (business_hours_start >= business_hours_end) {
                errors.push('Business hours start time must be before end time');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Check if a given time is within business hours
     * @param {Date} date - Date to check
     * @param {Object} businessHours - Business hours configuration
     * @returns {boolean} True if within business hours
     */
    isWithinBusinessHours(date, businessHours) {
        const { timezone, business_hours_start, business_hours_end, exclude_weekends } = businessHours;
        
        if (!timezone || !business_hours_start || !business_hours_end) {
            return true; // No business hours configured, allow all times
        }
        
        try {
            // Convert UTC date to sequence timezone
            const zonedDate = utcToZonedTime(date, timezone);
            
            // Check if it's a weekend and weekends are excluded
            if (exclude_weekends) {
                const dayOfWeek = zonedDate.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday = 0, Saturday = 6
                    return false;
                }
            }
            
            // Extract time components
            const hours = zonedDate.getHours();
            const minutes = zonedDate.getMinutes();
            const seconds = zonedDate.getSeconds();
            const currentTime = hours * 3600 + minutes * 60 + seconds;
            
            // Parse business hours
            const [startHours, startMinutes, startSeconds] = business_hours_start.split(':').map(Number);
            const [endHours, endMinutes, endSeconds] = business_hours_end.split(':').map(Number);
            
            const startTime = startHours * 3600 + startMinutes * 60 + startSeconds;
            const endTime = endHours * 3600 + endMinutes * 60 + endSeconds;
            
            // Check if current time is within business hours
            return currentTime >= startTime && currentTime <= endTime;
            
        } catch (error) {
            console.error('Error checking business hours:', error.message);
            return true; // Fallback to allowing all times
        }
    }

    /**
     * Calculate the next business hours time from a given date
     * @param {Date} fromDate - Starting date
     * @param {Object} businessHours - Business hours configuration
     * @returns {Date} Next business hours time
     */
    calculateNextBusinessHoursTime(fromDate, businessHours) {
        const { timezone, business_hours_start, business_hours_end, exclude_weekends } = businessHours;
        
        if (!timezone || !business_hours_start || !business_hours_end) {
            // No business hours configured, return original date
            return fromDate;
        }
        
        try {
            // Convert UTC date to sequence timezone
            let zonedDate = utcToZonedTime(fromDate, timezone);
            
            // Parse business hours
            const [startHours, startMinutes, startSeconds] = business_hours_start.split(':').map(Number);
            const [endHours, endMinutes, endSeconds] = business_hours_end.split(':').map(Number);
            
            // Set the time to business hours start
            zonedDate.setHours(startHours, startMinutes, startSeconds, 0);
            
            // If the calculated time is before the original time, move to next day
            if (zonedDate <= utcToZonedTime(fromDate, timezone)) {
                zonedDate.setDate(zonedDate.getDate() + 1);
            }
            
            // Handle weekend exclusion
            if (exclude_weekends) {
                while (zonedDate.getDay() === 0 || zonedDate.getDay() === 6) {
                    zonedDate.setDate(zonedDate.getDate() + 1);
                }
            }
            
            // Convert back to UTC
            return zonedTimeToUtc(zonedDate, timezone);
            
        } catch (error) {
            console.error('Error calculating next business hours time:', error.message);
            return fromDate; // Fallback to original date
        }
    }

    /**
     * Add hours to a date while respecting business hours
     * @param {Date} fromDate - Starting date
     * @param {number} hoursToAdd - Hours to add
     * @param {Object} businessHours - Business hours configuration
     * @returns {Date} New date respecting business hours
     */
    addHoursRespectingBusinessHours(fromDate, hoursToAdd, businessHours) {
        const { timezone, business_hours_start, business_hours_end, exclude_weekends } = businessHours;
        
        if (!timezone || !business_hours_start || !business_hours_end) {
            // No business hours configured, just add hours
            const result = new Date(fromDate);
            result.setHours(result.getHours() + hoursToAdd);
            return result;
        }
        
        try {
            // Convert to sequence timezone
            let zonedDate = utcToZonedTime(fromDate, timezone);
            
            // Parse business hours
            const [startHours, startMinutes, startSeconds] = business_hours_start.split(':').map(Number);
            const [endHours, endMinutes, endSeconds] = business_hours_end.split(':').map(Number);
            
            const startTime = startHours * 3600 + startMinutes * 60 + startSeconds;
            const endTime = endHours * 3600 + endMinutes * 60 + endSeconds;
            const businessHoursDuration = endTime - startTime;
            
            // Calculate total business hours to add
            let remainingSeconds = Math.round(hoursToAdd * 3600);
            let currentDate = new Date(zonedDate);
            
            while (remainingSeconds > 0) {
                // Move to next business day if needed
                if (exclude_weekends) {
                    while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        currentDate.setHours(startHours, startMinutes, startSeconds, 0);
                    }
                }
                
                // Normalize to a valid business-hours starting point
                const currentTime = currentDate.getHours() * 3600 + currentDate.getMinutes() * 60 + currentDate.getSeconds();
                if (currentTime < startTime) {
                    // Before business hours: set to today's start
                    currentDate.setHours(startHours, startMinutes, startSeconds, 0);
                } else if (currentTime > endTime) {
                    // After business hours: move to next business day, then set to start
                    currentDate.setDate(currentDate.getDate() + 1);
                    if (exclude_weekends) {
                        while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
                            currentDate.setDate(currentDate.getDate() + 1);
                        }
                    }
                    currentDate.setHours(startHours, startMinutes, startSeconds, 0);
                }
                
                // Calculate how many business hours we can add today
                const currentTimeInSeconds = currentDate.getHours() * 3600 + currentDate.getMinutes() * 60 + currentDate.getSeconds();
                const remainingToday = endTime - currentTimeInSeconds;
                const secondsToSpend = Math.min(remainingSeconds, remainingToday);

                if (secondsToSpend > 0) {
                    currentDate = new Date(currentDate.getTime() + secondsToSpend * 1000);
                    remainingSeconds -= secondsToSpend;
                } else {
                    // Move to next business day start
                    currentDate.setDate(currentDate.getDate() + 1);
                    if (exclude_weekends) {
                        while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
                            currentDate.setDate(currentDate.getDate() + 1);
                        }
                    }
                    currentDate.setHours(startHours, startMinutes, startSeconds, 0);
                }
            }
            
            // Convert back to UTC
            return zonedTimeToUtc(currentDate, timezone);
            
        } catch (error) {
            console.error('Error adding hours respecting business hours:', error.message);
            // Fallback to simple addition
            const result = new Date(fromDate);
            result.setHours(result.getHours() + hoursToAdd);
            return result;
        }
    }

    /**
     * Format business hours for display
     * @param {Object} businessHours - Business hours configuration
     * @returns {string} Formatted business hours string
     */
    formatBusinessHours(businessHours) {
        const { timezone, business_hours_start, business_hours_end, exclude_weekends } = businessHours;
        
        if (!timezone || !business_hours_start || !business_hours_end) {
            return 'No business hours configured';
        }
        
        const startTime = business_hours_start.substring(0, 5); // HH:MM
        const endTime = business_hours_end.substring(0, 5); // HH:MM
        const timezoneDisplay = timezone.replace('_', ' ').replace('/', ' / ');
        const weekendText = exclude_weekends ? ' (excluding weekends)' : ' (including weekends)';
        
        return `${startTime} - ${endTime} ${timezoneDisplay}${weekendText}`;
    }
}

module.exports = BusinessHoursService; 