/**
 * Google Calendar & iCal Feed Aggregator
 * Royal Holloway Makers' Society
 */

// 1. Configure your iCal / Google Calendar (.ics) URLs here
const CALENDAR_FEEDS = [
  // Primary Makers' Society Google Calendar
  'https://calendar.zoho.eu/ical/zz0801123049a179a62a00a9dfb9fa7a1644b625a8241195bc01b5240c77ef420b4355ffa49a2ec9851624125c94c5aec401d67478',
  'https://calendar.zoho.eu/ical/zz08011230fd28e28846e862e1caa191853da53b374899ef355ed0d53e84d65125608bcee6b03f99e7d88db9dd2655194a3ee8e657'
];

// Helper to wrap calendar URLs in a CORS proxy for client-side fetching
function getProxiedUrl(url) {
  return `https://corsproxy.io/?${encodeURIComponent(url.trim())}`;
}

/**
 * Fetch and parse a single iCal URL
 * @param {string} feedUrl 
 * @returns {Promise<Array>} Array of parsed event objects
 */
async function fetchAndParseFeed(feedUrl) {
  try {
    const response = await fetch(getProxiedUrl(feedUrl));
    if (!response.ok) {
      throw new Error(`Failed to fetch feed (${response.status} ${response.statusText})`);
    }

    const icsText = await response.text();
    const jcalData = ICAL.parse(icsText);
    const vcalendar = new ICAL.Component(jcalData);
    const vevents = vcalendar.getAllSubcomponents('vevent');

    const now = new Date();
    // Look ahead 6 months for recurring event occurrences
    const maxLookahead = new Date();
    maxLookahead.setMonth(now.getMonth() + 6);

    const parsedEvents = [];

    vevents.forEach(vevent => {
      try {
        const event = new ICAL.Event(vevent);

        // Handle recurring events
        if (event.isRecurring()) {
          const iterator = event.iterator();
          let nextTime;
          let count = 0;
          const maxOccurrences = 50; // Safeguard against infinite loops

          while ((nextTime = iterator.next()) && count < maxOccurrences) {
            count++;
            const occurrenceDate = nextTime.toJSDate();

            // Stop if we exceed our lookahead horizon
            if (occurrenceDate > maxLookahead) break;

            // Only add if occurrence is in the future
            if (occurrenceDate >= now) {
              const duration = event.duration;
              const durationMs = duration ? (duration.toSeconds() * 1000) : (60 * 60 * 1000);
              const endDate = new Date(occurrenceDate.getTime() + durationMs);

              parsedEvents.push({
                uid: `${event.uid}_${occurrenceDate.getTime()}`,
                title: event.summary || 'Untitled Event',
                description: event.description || '',
                location: event.location || 'Shilling Building (TBA)',
                start: occurrenceDate,
                end: endDate,
                isRecurring: true
              });
            }
          }
        } else {
          // Single (non-recurring) event
          const startDate = event.startDate ? event.startDate.toJSDate() : null;
          const endDate = event.endDate ? event.endDate.toJSDate() : (startDate ? new Date(startDate.getTime() + 3600000) : null);

          if (startDate) {
            parsedEvents.push({
              uid: event.uid,
              title: event.summary || 'Untitled Event',
              description: event.description || '',
              location: event.location || 'Shilling (TBA)',
              start: startDate,
              end: endDate,
              isRecurring: false
            });
          }
        }
      } catch (err) {
        console.warn('Skipping malformed event:', err);
      }
    });

    return parsedEvents;
  } catch (error) {
    console.error(`Error loading calendar feed (${feedUrl}):`, error);
    return []; // Return empty array so other feeds can still succeed
  }
}

/**
 * Fetch and combine all feeds, then return the next N future events
 * @param {Array<string>} feedUrls 
 * @param {number} limit 
 * @returns {Promise<Array>}
 */
async function getNextUpcomingEvents(feedUrls = CALENDAR_FEEDS, limit = 3) {
  const now = new Date();

  // Fetch all feeds in parallel
  const feedPromises = feedUrls.map(url => fetchAndParseFeed(url));
  const results = await Promise.allSettled(feedPromises);

  // Flatten all events into a single array
  const allEvents = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // Filter for future events only (where end time >= now or start time >= now)
  const futureEvents = allEvents.filter(event => {
    if (event.end) {
      return event.end >= now;
    }
    return event.start && event.start >= now;
  });

  // Sort chronologically (ascending)
  futureEvents.sort((a, b) => a.start - b.start);

  // Remove potential duplicates (same title and start time across feeds)
  const uniqueEvents = [];
  const seen = new Set();

  for (const event of futureEvents) {
    const key = `${event.title}_${event.start.getTime()}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueEvents.push(event);
    }
  }

  // Return the next 3 events
  return uniqueEvents.slice(0, limit);
}

/**
 * Format a Date object into human-readable date & time strings
 */
function formatEventDateTime(date) {
  if (!date || isNaN(date.getTime())) return { dateStr: 'Date TBA', timeStr: '' };

  const dateStr = date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const timeStr = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return { dateStr, timeStr };
}

/**
 * Clean and truncate description text for preview cards
 */
function sanitizeDescription(desc, maxLength = 140) {
  if (!desc) return '';
  // Strip any raw HTML tags or weird characters
  const clean = desc.replace(/<[^>]*>/g, '').trim();
  if (clean.length <= maxLength) return clean;
  return clean.substring(0, maxLength).trim() + '...';
}

/**
 * Render events into the #calendarEventsContainer in index.html
 */
function renderEvents(events, container) {
  if (!container) return;

  if (!events || events.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <div class="card shadow-sm border p-4 d-inline-block" style="max-width: 500px;">
          <div class="fs-1 text-muted mb-3"><i class="bi bi-calendar-x"></i></div>
          <h5 class="fw-bold mb-2">No Upcoming Events Right Now</h5>
          <p class="text-muted small mb-3">
            We are currently scheduling our next term workshops and access hours. Check back soon or join our Discord community for live announcements!
          </p>
          <a href="#community" class="btn btn-makers-blue btn-sm rounded-pill px-3 py-1.5">
            <i class="bi bi-discord me-1"></i>Join Community
          </a>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = events.map(event => {
    const { dateStr, timeStr } = formatEventDateTime(event.start);
    const timeDisplay = timeStr ? `${dateStr} • ${timeStr}` : dateStr;
    const description = sanitizeDescription(event.description);
    const location = event.location || 'Shilling Building';

    return `
      <div class="col-12 col-md-6 col-lg-4">
        <div class="card h-100 shadow-sm border">
          <div class="card-body p-4 d-flex flex-column justify-content-between">
            <div>
              <div class="d-flex align-items-center justify-content-between mb-2">
                <span class="badge" style="background-color: #e0f2fe; color: #0284c7; border: 1px solid rgba(2, 132, 199, 0.25);">
                  <i class="bi bi-clock me-1"></i>Upcoming
                </span>
                ${event.isRecurring ? '<span class="badge bg-light text-muted border">Recurring</span>' : ''}
              </div>
              <h5 class="card-title fw-bold mb-2 text-dark">${event.title}</h5>
              ${description ? `<p class="card-text text-muted small mb-3">${description}</p>` : ''}
            </div>
            <div class="${description ? '' : 'mt-4'}">
              <div class="d-flex flex-column gap-2 text-muted small mb-3">
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-calendar-event text-primary"></i>
                  <span>${timeDisplay}</span>
                </div>
                <div class="d-flex align-items-start gap-2">
                  <i class="bi bi-geo-alt text-danger mt-0.5"></i>
                  <span>${location}</span>
                </div>
              </div>
              <a href="https://www.su.rhul.ac.uk/societies/a-z/makers/" target="_blank" rel="noopener noreferrer"
                class="btn btn-outline-dark btn-sm rounded-pill w-100">
                Event Details &rarr;
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Initialize calendar on page load
 */
async function initCalendar() {
  const container = document.getElementById('calendarEventsContainer');
  if (!container) return;

  // Show loading spinner placeholder
  container.innerHTML = `
    <div class="col-12 text-center py-5">
      <div class="spinner-border text-primary" role="status" style="width: 2.5rem; height: 2.5rem;">
        <span class="visually-hidden">Loading events...</span>
      </div>
      <p class="text-muted small mt-3">Fetching upcoming events from calendar...</p>
    </div>
  `;

  // Bind subscribe button if present
  const subBtn = document.getElementById('subscribeCalendarBtn');
  if (subBtn && CALENDAR_FEEDS.length > 0) {
    subBtn.href = CALENDAR_FEEDS[0];
    subBtn.target = '_blank';
    subBtn.rel = 'noopener noreferrer';
  }

  try {
    const upcomingEvents = await getNextUpcomingEvents(CALENDAR_FEEDS, 3);
    renderEvents(upcomingEvents, container);
  } catch (err) {
    console.error('Failed to load upcoming events:', err);
    container.innerHTML = `
      <div class="col-12 text-center py-4">
        <p class="text-danger small mb-2"><i class="bi bi-exclamation-triangle me-1"></i>Could not load live calendar events.</p>
        <button class="btn btn-outline-secondary btn-sm rounded-pill px-3" onclick="initCalendar()">
          <i class="bi bi-arrow-clockwise me-1"></i>Retry
        </button>
      </div>
    `;
  }
}

// Auto-run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCalendar);
} else {
  initCalendar();
}
